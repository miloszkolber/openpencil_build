import type { AdapterConfig } from './config'
import type { CloudClient, CloudDocument } from './cloud'
import { listDocuments, listWorkspaces } from './cloud'
import { LiveDocument } from './live'

export type OpenDocumentSummary = {
  id: string
  name: string
  workspaceId: string
  kind: 'design' | 'board'
  open: boolean
  active: boolean
  pages: { id: string; name: string }[]
  current_page_id?: string
  current_page_name?: string
}

export type DocumentTarget = {
  documentId: string
  documentName: string
  pageId: string
  pageName: string
}

export class DocumentManager {
  private readonly config: AdapterConfig
  private readonly client: CloudClient
  private readonly documents = new Map<string, LiveDocument>()
  private readonly opening = new Map<string, Promise<LiveDocument>>()
  private activeId: string | null = null
  private cloudCache: { at: number; documents: CloudDocument[] } | null = null

  constructor(config: AdapterConfig, client: CloudClient) {
    this.config = config
    this.client = client
  }

  openDocuments(): LiveDocument[] {
    return [...this.documents.values()].filter((document) => !document.isClosed)
  }

  activeDocument(): LiveDocument | null {
    if (this.activeId) {
      const active = this.documents.get(this.activeId)
      if (active && !active.isClosed) return active
    }
    const open = this.openDocuments()
    return open.length === 1 ? open[0] : null
  }

  document(documentId?: string): LiveDocument {
    const document = documentId ? this.documents.get(documentId) : this.activeDocument()
    if (!document || document.isClosed) {
      throw new Error(
        documentId
          ? `Document "${documentId}" is not open. Use open_document first.`
          : 'No OpenPencil document is open. Use open_document first.'
      )
    }
    return document
  }

  async open(documentId: string): Promise<LiveDocument> {
    const existing = this.documents.get(documentId)
    if (existing && !existing.isClosed) {
      this.activeId = documentId
      return existing
    }
    const pending = this.opening.get(documentId)
    if (pending) return pending
    const task = LiveDocument.open({
      client: this.client,
      documentId,
      agentName: this.config.agentName,
      saveDebounceMs: this.config.saveDebounceMs,
      onError: (message, error) => console.error(`[openpencil-mcp] ${message}`, error)
    }).then((document) => {
      this.documents.set(documentId, document)
      this.activeId = documentId
      return document
    }).finally(() => {
      this.opening.delete(documentId)
    })
    this.opening.set(documentId, task)
    return task
  }

  async close(documentId?: string, save = true): Promise<boolean> {
    const document = documentId ? this.documents.get(documentId) : this.activeDocument()
    if (!document) return false
    await document.close(save)
    this.documents.delete(document.id)
    if (this.activeId === document.id) this.activeId = null
    return true
  }

  async closeAll(): Promise<void> {
    await Promise.all([...this.documents.values()].map((document) => document.close(false)))
    this.documents.clear()
    this.activeId = null
  }

  setActive(documentId: string): DocumentTarget {
    this.document(documentId)
    this.activeId = documentId
    return this.document(documentId).target()
  }

  target(documentId?: string, pageId?: string): DocumentTarget {
    return this.document(documentId).target(pageId)
  }

  private async cloudDocuments(force = false): Promise<CloudDocument[]> {
    if (!force && this.cloudCache && Date.now() - this.cloudCache.at < 5_000) {
      return this.cloudCache.documents
    }
    const workspaces = this.config.workspaceId
      ? [{ id: this.config.workspaceId }]
      : await listWorkspaces(this.client)
    const documents = (
      await Promise.all(
        workspaces.map((workspace) => listDocuments(this.client, workspace.id))
      )
    ).flat()
    const unique = [...new Map(documents.map((document) => [document.id, document])).values()]
    this.cloudCache = { at: Date.now(), documents: unique }
    return unique
  }

  async summaries(): Promise<OpenDocumentSummary[]> {
    const cloud = await this.cloudDocuments()
    const open = this.openDocuments()
    const openById = new Map(open.map((document) => [document.id, document]))
    const summaries: OpenDocumentSummary[] = []
    for (const document of cloud) {
      const live = openById.get(document.id)
      if (live) {
        const target = live.target()
        summaries.push({
          id: document.id,
          name: document.name,
          workspaceId: document.workspaceId,
          kind: document.kind,
          open: true,
          active: document.id === this.activeId,
          pages: live.pages(),
          current_page_id: target.pageId,
          current_page_name: target.pageName
        })
      } else {
        summaries.push({
          id: document.id,
          name: document.name,
          workspaceId: document.workspaceId,
          kind: document.kind,
          open: false,
          active: false,
          pages: []
        })
      }
    }
    for (const live of open) {
      if (summaries.some((summary) => summary.id === live.id)) continue
      const target = live.target()
      summaries.push({
        id: live.id,
        name: live.name,
        workspaceId: '',
        kind: live.kind,
        open: true,
        active: live.id === this.activeId,
        pages: live.pages(),
        current_page_id: target.pageId,
        current_page_name: target.pageName
      })
    }
    return summaries
  }

  async workspaces() {
    return this.config.workspaceId
      ? (await listWorkspaces(this.client)).filter((workspace) => workspace.id === this.config.workspaceId)
      : listWorkspaces(this.client)
  }
}
