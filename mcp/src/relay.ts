import WebSocket from 'ws'
import {
  MAX_COLLAB_MESSAGE_BYTES,
  RELAY_CLOSE,
  RELAY_FORWARDING_BYTES,
  createRelayServerAssembler,
  decodeRelayServerFrame,
  relayClientMessages,
  type RelayClientFrame
} from '@open-pencil/cloud/contract'

export type CollabActionReceiver = (data: Uint8Array, peerId: string) => void
export type CollabAction = [
  send: (data: Uint8Array, peerId?: string) => void,
  receive: (handler: CollabActionReceiver) => void
]

export type CollabRoomTransport = {
  makeAction(namespace: string): CollabAction
  onPeerJoin(handler: (peerId: string) => void): void
  onPeerLeave(handler: (peerId: string) => void): void
  signalingConnected(): boolean
  readonly discoveryMs: number
  readonly media: null
  leave(): Promise<void>
}

export type JoinCollabRoom = (roomId: string) => CollabRoomTransport

export type RelayTicket = { token: string; expiresAt: string }

export type RelayOptions = {
  url: string
  ticket: (roomId: string) => Promise<RelayTicket | null>
  onRestored?: () => void
  onRefused?: (reason: string) => void
  onError?: (message: string, error: unknown) => void
}

const RELAY_DISCOVERY_MS = 1000
const TICKET_REFRESH_LEAD_MS = 60_000
const MINIMUM_REFRESH_MS = 5_000
const MAXIMUM_RECONNECT_MS = 30_000
const FINAL_CLOSE_CODES = new Set<number>([
  RELAY_CLOSE.unauthorized,
  RELAY_CLOSE.roomFull,
  RELAY_CLOSE.messageTooLarge,
  RELAY_CLOSE.protocol
])

function createActionRegistry(send: (namespace: string, data: Uint8Array, peerId?: string) => void) {
  const receivers = new Map<string, CollabActionReceiver>()
  return {
    makeAction(namespace: string): CollabAction {
      return [
        (data, peerId) => send(namespace, data, peerId),
        (handler) => {
          if (receivers.has(namespace)) throw new Error(`Action ${namespace} already registered`)
          receivers.set(namespace, handler)
        }
      ]
    },
    deliver(namespace: string, data: Uint8Array, peerId: string) {
      receivers.get(namespace)?.(data, peerId)
    },
    clear() {
      receivers.clear()
    }
  }
}

function reconnectDelay(attempt: number): number {
  return Math.min(MAXIMUM_RECONNECT_MS, 1000 * 2 ** attempt)
}

export function createRelayJoin(options: RelayOptions) {
  return (roomId: string): CollabRoomTransport => {
    const report =
      options.onError ?? ((message, error) => console.error(`[openpencil-mcp] ${message}`, error))
    const actions = createActionRegistry((namespace, payload, target) => {
      if (welcomed) send({ type: 'message', namespace, target: target ?? null, payload })
    })
    const peers = new Set<string>()
    let joinHandler: ((peerId: string) => void) | null = null
    let leaveHandler: ((peerId: string) => void) | null = null
    let socket: WebSocket | null = null
    let welcomed = false
    let left = false
    let ended = false
    let attempt = 0
    let refreshTimer: ReturnType<typeof setTimeout> | undefined
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined
    let ticketExpiresAt = 0

    function send(frame: RelayClientFrame) {
      const current = socket
      if (!current || current.readyState !== WebSocket.OPEN) return
      for (const message of relayClientMessages(frame)) current.send(message)
    }

    async function refresh() {
      const owner = socket
      try {
        const next = await options.ticket(roomId)
        if (left || socket !== owner) return
        if (!next) {
          restored()
          return
        }
        send({ type: 'auth', token: next.token })
        scheduleRefresh(next)
      } catch (error) {
        report('Refreshing the collaboration ticket failed:', error)
        if (!left && socket === owner && ticketExpiresAt - Date.now() > MINIMUM_REFRESH_MS) {
          refreshTimer = setTimeout(() => void refresh(), MINIMUM_REFRESH_MS)
        }
      }
    }

    function scheduleRefresh(ticket: RelayTicket) {
      clearTimeout(refreshTimer)
      ticketExpiresAt = Date.parse(ticket.expiresAt)
      const delay = Math.max(
        MINIMUM_REFRESH_MS,
        ticketExpiresAt - Date.now() - TICKET_REFRESH_LEAD_MS
      )
      refreshTimer = setTimeout(() => void refresh(), delay)
    }

    function forgetPeers() {
      welcomed = false
      const departed = [...peers]
      peers.clear()
      for (const peerId of departed) leaveHandler?.(peerId)
    }

    function addPeer(peerId: string) {
      if (peers.has(peerId)) return
      peers.add(peerId)
      joinHandler?.(peerId)
    }

    function handleFrame(data: Uint8Array) {
      const frame = decodeRelayServerFrame(data)
      if (!frame) return
      switch (frame.type) {
        case 'welcome':
          welcomed = true
          attempt = 0
          for (const peerId of frame.peers) addPeer(peerId)
          return
        case 'join':
          addPeer(frame.peerId)
          return
        case 'leave':
          if (peers.delete(frame.peerId)) leaveHandler?.(frame.peerId)
          return
        case 'message':
          actions.deliver(frame.namespace, frame.payload, frame.from)
      }
    }

    function reconnect() {
      if (left || ended) return
      reconnectTimer = setTimeout(() => void connect(), reconnectDelay(attempt))
      attempt += 1
    }

    function restored() {
      if (ended) return
      ended = true
      clearTimeout(refreshTimer)
      clearTimeout(reconnectTimer)
      const current = socket
      socket = null
      current?.close(1000, 'The document was restored')
      forgetPeers()
      options.onRestored?.()
    }

    async function connect() {
      if (left || ended) return
      let ticket: RelayTicket | null
      try {
        ticket = await options.ticket(roomId)
      } catch (error) {
        report('Requesting a collaboration ticket failed:', error)
        reconnect()
        return
      }
      if (left || ended) return
      if (!ticket) {
        restored()
        return
      }
      const next = new WebSocket(options.url)
      next.binaryType = 'arraybuffer'
      socket = next
      next.on('open', () => {
        if (socket !== next) return
        send({ type: 'auth', token: ticket.token })
        scheduleRefresh(ticket)
      })
      const assembler = createRelayServerAssembler(
        () => MAX_COLLAB_MESSAGE_BYTES + RELAY_FORWARDING_BYTES
      )
      next.on('message', (raw: WebSocket.RawData) => {
        if (socket !== next) return
        const data = Array.isArray(raw)
          ? Buffer.concat(raw)
          : Buffer.isBuffer(raw)
            ? raw
            : Buffer.from(raw)
        const assembled = assembler.push(new Uint8Array(data))
        if (assembled.type === 'frame') handleFrame(assembled.data)
        else if (assembled.type !== 'partial') {
          report('The collaboration relay sent an unreadable frame:', assembled)
          next.close(1000, 'Unreadable collaboration frame')
        }
      })
      next.on('close', (code: number, reason: Buffer) => {
        if (socket !== next) return
        socket = null
        clearTimeout(refreshTimer)
        forgetPeers()
        if (code === RELAY_CLOSE.restored) {
          restored()
          return
        }
        if (FINAL_CLOSE_CODES.has(code)) {
          const why = reason.toString() || String(code)
          report('The collaboration relay refused this peer:', why)
          options.onRefused?.(why)
          return
        }
        reconnect()
      })
      next.on('error', (error: Error) => {
        report('The collaboration relay connection failed:', error)
      })
    }

    void connect()

    return {
      makeAction: actions.makeAction,
      onPeerJoin(handler) {
        joinHandler = handler
        for (const peerId of peers) queueMicrotask(() => handler(peerId))
      },
      onPeerLeave(handler) {
        leaveHandler = handler
      },
      signalingConnected: () => welcomed && socket?.readyState === WebSocket.OPEN,
      discoveryMs: RELAY_DISCOVERY_MS,
      media: null,
      async leave() {
        if (left) return
        left = true
        clearTimeout(refreshTimer)
        clearTimeout(reconnectTimer)
        actions.clear()
        peers.clear()
        const current = socket
        socket = null
        current?.close(1000, 'Left the room')
      }
    }
  }
}
