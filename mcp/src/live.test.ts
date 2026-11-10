import { expect, mock, test } from 'bun:test'

let upload: (input: any) => Promise<any>
let snapshot: () => Promise<Uint8Array>
mock.module('./cloud', () => ({ saveCloudDocument: (input: any) => upload(input), downloadCloudDocument: () => {} }))
mock.module('./document', () => ({ writeGraph: () => snapshot(), createFigma: () => {}, executeTool: () => {}, loadGraph: () => {}, measureDocumentText: () => {}, pageIdOf: () => {} }))
const { LiveDocument } = await import('./live')

function document() {
  return Object.assign(Object.create(LiveDocument.prototype), {
    id: 'doc', name: 'test', graph: { documentKind: 'design' }, client: {},
    revisionId: 'base', changed: true, changeVersion: 1,
    saveTimer: null, saveChain: Promise.resolve(), closing: false, destroyed: false
  })
}

test('conflicting saves do not retry or discard unsaved changes', async () => {
  const doc = document()
  let calls = 0
  snapshot = async () => new Uint8Array([1])
  upload = async (input) => {
    calls++
    expect(input.baseRevisionId).toBe('base')
    throw new Error('revision conflict')
  }
  await expect(doc.close()).rejects.toThrow('revision conflict')
  expect(calls).toBe(1)
  expect(doc.changed).toBe(true)
  expect(doc.closing).toBe(false)
})

test('edits arriving during an upload remain dirty', async () => {
  const doc = document()
  snapshot = async () => new Uint8Array([1])
  upload = async () => {
    doc.changeVersion++
    return { currentRevisionId: 'next' }
  }
  await doc.save()
  expect(doc.revisionId).toBe('next')
  expect(doc.changed).toBe(true)
})
