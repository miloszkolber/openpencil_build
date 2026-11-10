import * as awarenessProtocol from 'y-protocols/awareness'
import * as Y from 'yjs'

import { RELAY_SERVER_PEER } from '@open-pencil/cloud/contract'
import type { FigmaAPI } from '@open-pencil/core/figma-api'
import { computeAllLayouts } from '@open-pencil/core/layout'
import type { SceneGraph } from '@open-pencil/scene-graph'

import {
  bindCollabGraphEvents,
  bindDocumentSync,
  bindVariableSync,
  createYjsGraphSync,
  readRoot,
  registerYjsObservers,
  roomDocumentData,
  TREE_FORMAT,
  writeRoomName
} from '../vendor/collab/index.ts'
import {
  type CloudClient,
  type CloudDocument,
  downloadCloudDocument,
  saveCloudDocument
} from './cloud'
import { connectCollabRoom } from './connection'
import { createFigma, executeTool, loadGraph, measureDocumentText, pageIdOf, writeGraph } from './document'
import { createRelayJoin, type CollabRoomTransport } from './relay'

type EditorEvent = (...args: unknown[]) => void

export type LiveDocumentOptions = {
  client: CloudClient
  documentId: string
  agentName: string
  saveDebounceMs: number
  onError?: (message: string, error: unknown) => void
}

export type LiveDocumentTarget = {
  documentId: string
  documentName: string
  pageId: string
  pageName: string
}

export class LiveDocument {
  readonly id: string
  readonly name: string
  readonly kind: 'design' | 'board'
  readonly graph: SceneGraph
  readonly ydoc = new Y.Doc()
  readonly meta = this.ydoc.getMap('meta')
  readonly ynodes = this.ydoc.getMap('nodes')
  readonly yimages = this.ydoc.getMap('images')
  readonly data = roomDocumentData(this.ydoc)
  readonly yvariables = this.ydoc.getMap('variables')
  readonly ycollections = this.ydoc.getMap('collections')
  readonly awareness = new awarenessProtocol.Awareness(this.ydoc)

  private readonly client: CloudClient
  private readonly options: LiveDocumentOptions
  private readonly listeners = new Map<string, Set<EditorEvent>>()
  private readonly editor: {
    graph: SceneGraph
    isReadOnly: () => boolean
    onEditorEvent: (event: string, handler: EditorEvent) => () => void
    requestRender: () => void
    refreshVariables: () => void
    refreshDocumentSettings: () => void
  }
  private figma!: FigmaAPI
  private sync!: ReturnType<typeof createYjsGraphSync>
  private documentSync!: ReturnType<typeof bindDocumentSync>
  private variableSync!: ReturnType<typeof bindVariableSync>
  private unbindGraphEvents!: () => void
  private unregisterObservers!: () => void
  private room!: CollabRoomTransport
  private stopSynced!: () => void
  private stopVersions!: () => void
  private saveTimer: ReturnType<typeof setTimeout> | null = null
  private saveChain: Promise<unknown> = Promise.resolve()
  private closing = false
  private destroyed = false
  private changed = false
  private changeVersion = 0
  private revisionId: string

  private constructor(options: LiveDocumentOptions, document: CloudDocument, graph: SceneGraph, revisionId: string) {
    this.options = options
    this.client = options.client
    this.id = document.id
    this.name = document.name
    this.kind = document.kind
    this.revisionId = revisionId
    this.graph = graph
    this.editor = {
      graph,
      isReadOnly: () => false,
      onEditorEvent: (event, handler) => this.onEditorEvent(event, handler),
      requestRender: () => {},
      refreshVariables: () => {},
      refreshDocumentSettings: () => {}
    }
  }

  static async open(options: LiveDocumentOptions): Promise<LiveDocument> {
    const downloaded = await downloadCloudDocument(options.client, options.documentId)
    const graph = await loadGraph(downloaded.bytes)
    const live = new LiveDocument(options, downloaded.document, graph, downloaded.revisionId)
    try {
      await live.start()
      return live
    } catch (error) {
      await live.close(false).catch(() => undefined)
      throw error
    }
  }

  private onEditorEvent(event: string, handler: EditorEvent): () => void {
    const set = this.listeners.get(event) ?? new Set()
    set.add(handler)
    this.listeners.set(event, set)
    return () => set.delete(handler)
  }

  private emit(event: string, ...args: unknown[]): void {
    for (const handler of this.listeners.get(event) ?? []) handler(...args)
  }

  private async start(): Promise<void> {
    this.figma = await createFigma(this.graph)
    for (const event of [
      'node:created',
      'node:updated',
      'node:previewUpdated',
      'node:deleted',
      'node:reparented',
      'node:reordered'
    ]) {
      this.graph.emitter.on(event, (...args: unknown[]) => this.emit(event, ...args))
    }

    let suppressYjs = false
    this.sync = createYjsGraphSync({
      getEditor: () => this.editor,
      getYdoc: () => (this.destroyed ? null : this.ydoc),
      getYnodes: () => (this.destroyed ? null : this.ynodes),
      getYimages: () => (this.destroyed ? null : this.yimages),
      setSuppressYjsEvents: (value: boolean) => {
        suppressYjs = value
      },
      onApplied: () => computeAllLayouts(this.graph)
    })
    this.documentSync = bindDocumentSync({
      editor: this.editor,
      ydoc: this.ydoc,
      data: this.data,
      meta: this.meta
    })
    this.variableSync = bindVariableSync({
      editor: this.editor,
      ydoc: this.ydoc,
      yvariables: this.yvariables,
      ycollections: this.ycollections
    })
    this.unbindGraphEvents = bindCollabGraphEvents({
      editor: this.editor,
      getYdoc: () => (this.destroyed ? null : this.ydoc),
      getYnodes: () => (this.destroyed ? null : this.ynodes),
      getSuppressGraphSync: () => suppressYjs,
      syncLocalEdit: this.sync.syncLocalEdit
    })
    this.unregisterObservers = registerYjsObservers({
      editor: this.editor,
      ynodes: this.ynodes,
      yimages: this.yimages,
      getSuppressYjsEvents: () => suppressYjs,
      setSuppressGraphSync: (value: boolean) => {
        suppressYjs = value
      },
      applyYjsToGraph: (events) => {
        this.sync.applyYjsToGraph(events)
      }
    })
    this.awareness.setLocalState({
      user: { name: this.options.agentName, color: '#7c3aed' },
      hasFile: true,
      treeFormat: TREE_FORMAT
    })

    const ticket = await this.client.getCollaborationTicket(this.id)
    if (ticket.permission !== 'edit') {
      throw new Error(`The Cloud account has only "${ticket.permission}" access to this document`)
    }
    if (!ticket.serverURL) throw new Error('The Cloud document has no collaboration relay')
    const roomId = ticket.roomId
    const join = createRelayJoin({
      url: ticket.serverURL,
      ticket: async (requestedRoom) => {
        const next = await this.client.getCollaborationTicket(this.id)
        if (next.roomId !== requestedRoom) return null
        return { token: next.token, expiresAt: next.expiresAt }
      },
      onRestored: () => {
        void this.close(false).catch(() => undefined)
        this.options.onError?.('The document was restored; reopen it to continue', new Error('room restored'))
      },
      onRefused: (reason) => {
        void this.close(false).catch(() => undefined)
        this.options.onError?.(`The collaboration relay refused the adapter: ${reason}`, new Error(reason))
      },
      onError: this.options.onError
    })

    let resolveSynced!: () => void
    let rejectSynced!: (error: unknown) => void
    const synced = new Promise<void>((resolve, reject) => {
      resolveSynced = resolve
      rejectSynced = reject
    })
    const timeout = setTimeout(() => rejectSynced(new Error('Timed out waiting for the Cloud room')), 20_000)
    const connection = connectCollabRoom({
      roomId,
      ydoc: this.ydoc,
      awareness: this.awareness,
      updatePeersList: () => {},
      joinRoom: join
    })
    this.room = connection.room
    this.stopSynced = connection.onSynced((peerId) => {
      if (peerId === RELAY_SERVER_PEER) {
        clearTimeout(timeout)
        resolveSynced()
      }
    })
    this.stopVersions = connection.onVersionsChanged(() => {})
    await synced
    if (this.closing || this.destroyed) return

    if (readRoot(this.meta) === undefined) {
      this.documentSync.share()
      this.sync.syncAllNodesToYjs()
      this.variableSync.share()
      writeRoomName(this.meta, this.name)
    } else {
      this.sync.dropLayersOutsideRoom()
      this.sync.syncHeldBackEdits()
      this.documentSync.follow()
    }
    const pages = this.graph.getPages()
    if (!pages.some((page) => page.id === this.figma.currentPageId) && pages[0]) {
      const page = this.figma.getNodeById(pages[0].id)
      if (page) this.figma.currentPage = page
    }
  }

  target(pageId?: string): LiveDocumentTarget {
    const selected = pageIdOf(this.figma, this.graph, pageId)
    const page = this.graph.getNode(selected)
    return {
      documentId: this.id,
      documentName: this.name,
      pageId: selected,
      pageName: page?.name ?? ''
    }
  }

  pages(): { id: string; name: string }[] {
    return this.graph.getPages().map((page) => ({ id: page.id, name: page.name }))
  }

  async run(name: string, args: Record<string, unknown>, pageId?: string): Promise<unknown> {
    if (this.destroyed || this.closing) throw new Error('The document room is closed; reopen the document')
    this.target(pageId)
    const { result, changed } = await executeTool(this.graph, this.figma, name, args)
    if (changed) {
      this.changed = true
      this.changeVersion += 1
      this.emit('history:changed')
      await measureDocumentText(this.graph)
      this.scheduleSave()
    }
    return result
  }

  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => {
      void this.save(false).catch((error: unknown) => {
        this.options.onError?.('Saving the Cloud document failed', error)
      })
    }, this.options.saveDebounceMs)
  }

  async save(force = true): Promise<CloudDocument | null> {
    if (!force && !this.changed) return null
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
    }
    const run = this.saveChain.then(async () => {
      const version = this.changeVersion
      const bytes = await writeGraph(this.graph)
      const saved = await saveCloudDocument({
        client: this.client,
        documentId: this.id,
        name: this.name,
        kind: this.graph.documentKind,
        baseRevisionId: this.revisionId,
        bytes
      })
      this.revisionId = saved.currentRevisionId
      if (this.changeVersion === version) this.changed = false
      return saved
    })
    this.saveChain = run.catch(() => undefined)
    return run
  }

  get isClosed(): boolean {
    return this.destroyed || this.closing
  }

  async close(save = true): Promise<void> {
    if (this.destroyed || this.closing) return
    this.closing = true
    if (save) {
      try {
        await this.save(false)
      } catch (error) {
        this.closing = false
        throw error
      }
    }
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.unbindGraphEvents?.()
    this.variableSync?.dispose()
    this.documentSync?.dispose()
    this.unregisterObservers?.()
    this.stopSynced?.()
    this.stopVersions?.()
    await this.room?.leave()
    this.awareness.destroy()
    this.ydoc.destroy()
    this.destroyed = true
  }
}
