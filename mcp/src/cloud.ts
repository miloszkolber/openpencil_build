import { createHash, randomUUID } from 'node:crypto'

import {
  CLOUD_IMAGE_NAME_PATTERN,
  type DocumentDownload,
  type DocumentImageDownload,
  type ObjectUploadTarget,
  type WorkspaceSummary
} from '@open-pencil/cloud/contract'
import {
  createCloudAPIClient,
  discoverCloud,
  pollCloudDeviceToken,
  requestCloudDeviceAuthorization
} from '@open-pencil/cloud/client'
import { limitAsync } from 'es-toolkit'
import { unzipSync, zipSync, type Zippable } from 'fflate'

import type { CloudToken } from './config'

const IMAGE_ENTRY_PREFIX = 'images/'
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04]
const IMAGE_CONCURRENCY = 6
const PART_CONCURRENCY = 4

export type CloudClient = ReturnType<typeof createCloudAPIClient>

export type CloudDocument = {
  id: string
  workspaceId: string
  name: string
  kind: 'design' | 'board'
  currentRevisionId: string
  version: number
  updatedAt: string
}

export type CloudDocumentBytes = {
  document: CloudDocument
  bytes: Uint8Array
  revisionId: string
}

export function cloudClient(token: CloudToken, accessToken: () => string = () => token.accessToken): CloudClient {
  const base = new URL(token.serverURL)
  if (!base.pathname.replace(/\/$/, '').endsWith('/api')) {
    base.pathname = `${base.pathname.replace(/\/$/, '')}/api`
  }
  base.search = ''
  base.hash = ''
  return createCloudAPIClient(base.href, {
    fetch: (input, init) => {
      const request = new Request(input, init)
      request.headers.set('Authorization', `Bearer ${accessToken()}`)
      return fetch(request)
    }
  })
}

export async function loginCloud(serverURL: string): Promise<CloudToken> {
  const discovery = await discoverCloud(serverURL)
  const connectionId = randomUUID()
  const authorization = await requestCloudDeviceAuthorization(discovery, connectionId)
  console.log(`Open ${authorization.verification_uri_complete}`)
  console.log(`Approve code ${authorization.user_code}`)
  const result = await pollCloudDeviceToken(discovery, connectionId, authorization)
  return {
    serverURL,
    accessToken: result.access_token,
    savedAt: new Date().toISOString()
  }
}

export async function listWorkspaces(client: CloudClient): Promise<WorkspaceSummary[]> {
  return (await client.listWorkspaces()).workspaces
}

export async function listDocuments(
  client: CloudClient,
  workspaceId: string
): Promise<CloudDocument[]> {
  return (await client.listDocuments(workspaceId)) as CloudDocument[]
}

function checksum(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('base64')
}

function isZip(bytes: Uint8Array): boolean {
  return ZIP_SIGNATURE.every((byte, index) => bytes[index] === byte)
}

function fetchVerified(
  target: { url: string; method: string; headers: Record<string, string> },
  expected: { byteSize: number; checksum: string }
): Promise<Uint8Array> {
  return fetch(target.url, { method: target.method, headers: target.headers }).then(
    async (response) => {
      if (!response.ok) {
        throw new Error(`Cloud object download failed with HTTP ${response.status}`)
      }
      const bytes = new Uint8Array(await response.arrayBuffer())
      if (bytes.byteLength !== expected.byteSize || checksum(bytes) !== expected.checksum) {
        throw new Error('The downloaded Cloud object does not match what the server stored')
      }
      return bytes
    }
  )
}

export async function downloadCloudDocument(
  client: CloudClient,
  documentId: string
): Promise<CloudDocumentBytes> {
  const download = await client.getDocument(documentId)
  const image = limitAsync(
    async (item: DocumentImageDownload) => ({
      name: item.name,
      bytes: await fetchVerified(item.download, item)
    }),
    IMAGE_CONCURRENCY
  )
  const [lean, ...images] = await Promise.all([
    fetchVerified(download.download, download),
    ...download.images.map(image)
  ])
  return {
    document: download.document as CloudDocument,
    bytes: assembleCloudDocument(lean, images),
    revisionId: download.revisionId
  }
}

export function splitCloudDocument(bytes: Uint8Array): {
  lean: Uint8Array
  images: { name: string; bytes: Uint8Array }[]
} {
  if (!isZip(bytes)) return { lean: bytes, images: [] }
  const entries = unzipSync(bytes)
  const images: { name: string; bytes: Uint8Array }[] = []
  const rest: Zippable = {}
  for (const [path, data] of Object.entries(entries)) {
    const name = path.startsWith(IMAGE_ENTRY_PREFIX) ? path.slice(IMAGE_ENTRY_PREFIX.length) : null
    if (name && CLOUD_IMAGE_NAME_PATTERN.test(name) && data.byteLength > 0) {
      images.push({ name, bytes: data })
    } else {
      rest[path] = [data, { level: 0 }]
    }
  }
  return images.length === 0 ? { lean: bytes, images } : { lean: zipSync(rest), images }
}

export function assembleCloudDocument(
  lean: Uint8Array,
  images: { name: string; bytes: Uint8Array }[]
): Uint8Array {
  if (images.length === 0) return lean
  const entries: Zippable = {}
  for (const [path, data] of Object.entries(unzipSync(lean))) entries[path] = [data, { level: 0 }]
  for (const image of images) entries[`${IMAGE_ENTRY_PREFIX}${image.name}`] = [image.bytes, { level: 0 }]
  return zipSync(entries)
}

function body(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return bytes.buffer instanceof ArrayBuffer
    ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    : Uint8Array.from(bytes)
}

async function putCloudObject(
  target: ObjectUploadTarget,
  bytes: Uint8Array
): Promise<{ uploadId: string; parts: { partNumber: number; etag: string }[] } | undefined> {
  if (target.kind === 'single') {
    const response = await fetch(target.url, {
      method: target.method,
      headers: target.headers,
      body: body(bytes)
    })
    if (!response.ok) throw new Error(`Cloud object upload failed with HTTP ${response.status}`)
    return undefined
  }
  const putPart = limitAsync(async (part: (typeof target.parts)[number]) => {
    const offset = (part.partNumber - 1) * target.partSize
    const response = await fetch(part.url, {
      method: part.method,
      headers: part.headers,
      body: body(bytes.subarray(offset, offset + target.partSize))
    })
    if (!response.ok) throw new Error(`Cloud object part upload failed with HTTP ${response.status}`)
    const etag = response.headers.get('etag')
    if (!etag) throw new Error('Cloud multipart upload response did not include an ETag')
    return { partNumber: part.partNumber, etag }
  }, PART_CONCURRENCY)
  const parts = await Promise.all(target.parts.map(putPart))
  return { uploadId: target.uploadId, parts }
}

async function uploadImages(
  client: CloudClient,
  documentId: string,
  images: { name: string; bytes: Uint8Array }[]
): Promise<{ name: string; checksum: string }[]> {
  if (images.length === 0) return []
  const named = images.map((image) => ({ ...image, checksum: checksum(image.bytes) }))
  const byChecksum = new Map(named.map((image) => [image.checksum, image.bytes]))
  const offers = await client.requestImageUploads(documentId, {
    images: named.map((image) => ({ checksum: image.checksum, byteSize: image.bytes.byteLength }))
  })
  const uploaded = await Promise.all(
    offers.map(async (offer) => {
      const bytes = byChecksum.get(offer.checksum)
      if (!bytes) throw new Error('The server offered an upload for an image this save lacks')
      const multipart = await putCloudObject(offer.upload, bytes)
      return { uploadId: offer.uploadId, checksum: offer.checksum, multipart }
    })
  )
  if (uploaded.length > 0) await client.commitImageUploads(documentId, uploaded)
  return named.map((image) => ({ name: image.name, checksum: image.checksum }))
}

export async function saveCloudDocument(input: {
  client: CloudClient
  documentId: string
  name: string
  kind: 'design' | 'board'
  baseRevisionId: string
  bytes: Uint8Array
}): Promise<CloudDocument> {
  const { lean, images } = splitCloudDocument(input.bytes)
  const named = await uploadImages(input.client, input.documentId, images)
  const leanChecksum = checksum(lean)
  const upload = await input.client.createUpload(input.documentId, {
    baseRevisionId: input.baseRevisionId,
    byteSize: lean.byteLength,
    checksum: leanChecksum,
    contentType: 'application/octet-stream'
  })
  const multipart = await putCloudObject(upload.upload, lean)
  const committed = await input.client.commitUpload(upload.id, {
    checksum: leanChecksum,
    name: input.name,
    kind: input.kind,
    ...(multipart ? { multipart } : {}),
    images: named
  })
  return committed as CloudDocument
}
