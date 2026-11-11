import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { discoverCloud, signInToCloudWithEmail } from '@open-pencil/cloud/client'
import { cloudClient } from './cloud'
import { type CloudToken, writeCloudToken } from './config'

export function managedCloudSession(initial: CloudToken, dataDir: string) {
  let current = initial
  let checking: Promise<void> | null = null
  let status: 'checking' | 'ready' | 'error' = 'checking'
  const client = cloudClient(initial, () => current.accessToken)

  async function checkOnce() {
    const session = await client.getSession()
    if (session) return
    const file = join(dataDir, 'credentials.json')
    const info = await stat(file)
    if (!info.isFile() || (info.mode & 0o077) !== 0) {
      throw new Error('Cloud credentials must be a private file')
    }
    const value: unknown = JSON.parse(await readFile(file, 'utf8'))
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid Cloud credentials')
    const { email, password } = value as Record<string, unknown>
    if (typeof email !== 'string' || !email || typeof password !== 'string' || !password) {
      throw new Error('Invalid Cloud credentials')
    }
    const server = new URL(initial.serverURL)
    if (server.protocol !== 'https:' && !(server.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(server.hostname))) {
      throw new Error('Cloud credentials require HTTPS or a loopback server')
    }
    const discovery = await discoverCloud(initial.serverURL)
    if (new URL(discovery.authURL).origin !== new URL(initial.serverURL).origin) {
      throw new Error('Cloud authentication origin differs from the configured server')
    }
    const result = await signInToCloudWithEmail(discovery, { email, password })
    if (!result.ok || result.value.status !== 'signed-in') throw new Error('Cloud sign-in failed or requires another factor')
    const next = { serverURL: initial.serverURL, accessToken: result.value.token, savedAt: new Date().toISOString() }
    const verified = await cloudClient(next).getSession()
    if (!verified || verified.user.email.toLowerCase() !== email.toLowerCase()) {
      throw new Error('Cloud returned an unexpected identity')
    }
    await writeCloudToken(join(dataDir, 'cloud.json'), next)
    current = next
  }

  function check(): Promise<void> {
    if (!checking) {
      checking = checkOnce().then(() => { status = 'ready' }, (error: unknown) => {
        status = 'error'
        throw error
      }).finally(() => { checking = null })
    }
    return checking
  }
  return { client, check, status: () => status }
}
