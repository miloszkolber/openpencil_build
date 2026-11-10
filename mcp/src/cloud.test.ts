import { expect, test } from 'bun:test'
import { saveCloudDocument } from './cloud'

test('save sends the original base revision and propagates a Cloud conflict', async () => {
  const conflict = new Error('revision conflict')
  const requests: unknown[] = []
  const client = {
    createUpload: async (_id: string, request: unknown) => {
      requests.push(request)
      throw conflict
    }
  }
  await expect(saveCloudDocument({
    client: client as never, documentId: 'doc', name: 'test', kind: 'design',
    baseRevisionId: 'original', bytes: new Uint8Array([1, 2, 3])
  })).rejects.toBe(conflict)
  expect(requests).toHaveLength(1)
  expect((requests[0] as { baseRevisionId: string }).baseRevisionId).toBe('original')
})

test('a conflict at commit is propagated without retrying the uploaded snapshot', async () => {
  const conflict = new Error('commit conflict')
  const previousFetch = globalThis.fetch
  let uploads = 0
  let commits = 0
  globalThis.fetch = (async () => new Response('', { status: 200 })) as typeof fetch
  try {
    const client = {
      createUpload: async (_id: string, request: { baseRevisionId: string }) => {
        uploads++
        expect(request.baseRevisionId).toBe('original')
        return { id: 'upload', upload: { kind: 'single', url: 'https://example.invalid', method: 'PUT', headers: {} } }
      },
      commitUpload: async () => {
        commits++
        throw conflict
      }
    }
    await expect(saveCloudDocument({
      client: client as never, documentId: 'doc', name: 'test', kind: 'design',
      baseRevisionId: 'original', bytes: new Uint8Array([1, 2, 3])
    })).rejects.toBe(conflict)
    expect(uploads).toBe(1)
    expect(commits).toBe(1)
  } finally {
    globalThis.fetch = previousFetch
  }
})
