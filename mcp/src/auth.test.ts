import { afterEach, expect, mock, test } from 'bun:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

let available = false
let signIns = 0
let requiresFactor = false
mock.module('./cloud', () => ({
  cloudClient: (_token: unknown, getToken?: () => string) => ({
    getSession: async () => getToken ? (available ? { user: { email: 'bot@example.com' } } : null) : { user: { email: 'bot@example.com' } }
  })
}))
mock.module('@open-pencil/cloud/client', () => ({
  discoverCloud: async () => ({ authURL: 'https://cloud.example.com/api/auth' }),
  signInToCloudWithEmail: async () => { signIns++; return { ok: true, value: requiresFactor ? { status: 'two-step' } : { status: 'signed-in', token: 'replacement' } } }
}))
const { managedCloudSession } = await import('./auth')
const dirs: string[] = []
afterEach(async () => { await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))); available = false; requiresFactor = false; signIns = 0 })

test('recovers once and atomically persists a verified replacement', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mcp-auth-')); dirs.push(dir)
  await writeFile(join(dir, 'credentials.json'), JSON.stringify({ email: 'bot@example.com', password: 'secret' }), { mode: 0o600 })
  const session = managedCloudSession({ serverURL: 'https://cloud.example.com', accessToken: 'old', savedAt: '' }, dir)
  await Promise.all([session.check(), session.check()])
  expect(signIns).toBe(1)
  expect(JSON.parse(await readFile(join(dir, 'cloud.json'), 'utf8')).accessToken).toBe('replacement')
})

test('valid session does not need credential file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mcp-auth-')); dirs.push(dir)
  available = true
  await managedCloudSession({ serverURL: 'https://cloud.example.com', accessToken: 'old', savedAt: '' }, dir).check()
  expect(signIns).toBe(0)
})

test('refuses a credentials file readable by other users', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mcp-auth-')); dirs.push(dir)
  await writeFile(join(dir, 'credentials.json'), JSON.stringify({ email: 'bot@example.com', password: 'secret' }), { mode: 0o644 })
  await expect(managedCloudSession({ serverURL: 'https://cloud.example.com', accessToken: 'old', savedAt: '' }, dir).check()).rejects.toThrow('private file')
  expect(signIns).toBe(0)
})

test('refuses to send credentials to a remote HTTP endpoint', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mcp-auth-')); dirs.push(dir)
  await writeFile(join(dir, 'credentials.json'), JSON.stringify({ email: 'bot@example.com', password: 'secret' }), { mode: 0o600 })
  await expect(managedCloudSession({ serverURL: 'http://cloud.example.com', accessToken: 'old', savedAt: '' }, dir).check()).rejects.toThrow('HTTPS')
  expect(signIns).toBe(0)
})

test('additional factor requirement leaves the old token on disk and reports error', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mcp-auth-')); dirs.push(dir)
  const old = JSON.stringify({ serverURL: 'https://cloud.example.com', accessToken: 'old', savedAt: '' })
  await writeFile(join(dir, 'credentials.json'), JSON.stringify({ email: 'bot@example.com', password: 'secret' }), { mode: 0o600 })
  await writeFile(join(dir, 'cloud.json'), old, { mode: 0o600 })
  requiresFactor = true
  const session = managedCloudSession(JSON.parse(old), dir)
  await expect(session.check()).rejects.toThrow('another factor')
  expect(session.status()).toBe('error')
  expect(await readFile(join(dir, 'cloud.json'), 'utf8')).toBe(old)
})
