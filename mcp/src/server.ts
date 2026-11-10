import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'

import { McpServer, WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/server'
import { toStandardJsonSchema } from '@valibot/to-json-schema'
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import * as v from 'valibot'

import { fail, ok, registerTools } from '@open-pencil/mcp'

import { cloudClient } from './cloud'
import { readCloudToken, readConfig } from './config'
import { DocumentManager } from './manager'

const config = readConfig()
if (!config.mcpToken) throw new Error('OPENPENCIL_MCP_TOKEN is required')
const token = await readCloudToken(config.tokenFile)
if (!token) {
  throw new Error(
    `No Cloud token at ${config.tokenFile}. Run the login command first (bun src/login.ts).`
  )
}
const client = cloudClient(token)
const manager = new DocumentManager(config, client)

setInterval(() => {
  void client.getSession().then((session) => {
    if (!session) console.error('[openpencil-mcp] Cloud session expired; run the login command again')
  }).catch(() => {
    console.error('[openpencil-mcp] Cloud session check failed; check connectivity and authentication')
  })
}, 6 * 60 * 60_000).unref()

const disabledTools = [
  'get_selection',
  'select_nodes',
  'undo',
  'redo',
  'get_settings',
  'update_settings',
  'new_document',
  'open_file',
  'list_recent_files',
  'save_file'
]

function authorized(header: string | undefined, alternate: string | undefined): boolean {
  const expected = createHash('sha256').update(config.mcpToken ?? '').digest()
  const provided = header?.startsWith('Bearer ') ? header.slice(7) : alternate
  if (!provided) return false
  const actual = createHash('sha256').update(provided).digest()
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

async function sendRPC(body: Record<string, unknown>): Promise<unknown> {
  const command = typeof body.command === 'string' ? body.command : ''
  const args =
    body.args && typeof body.args === 'object' && !Array.isArray(body.args)
      ? (body.args as Record<string, unknown>)
      : {}
  if (command === 'list_documents') {
    return { ok: true, result: { documents: await manager.summaries() } }
  }
  if (command === 'activate_document') {
    const documentId = typeof args.document_id === 'string' ? args.document_id : ''
    const target = manager.setActive(documentId)
    return { ok: true, result: { activated: true }, target }
  }
  if (command === 'close_file') {
    const documentId = typeof args.document_id === 'string' ? args.document_id : undefined
    const document = manager.document(documentId)
    await manager.close(document.id, args.unsaved !== 'discard')
    return { ok: true, result: { closed: true } }
  }
  if (command === 'save_file') {
    const documentId = typeof args.document_id === 'string' ? args.document_id : undefined
    const document = manager.document(documentId)
    await document.save(true)
    return { ok: true, result: { saved: true }, target: document.target() }
  }
  if (command === 'tool') {
    const name = typeof args.name === 'string' ? args.name : ''
    const toolArgs =
      args.args && typeof args.args === 'object' && !Array.isArray(args.args)
        ? (args.args as Record<string, unknown>)
        : {}
    const documentId = typeof args.document_id === 'string' ? args.document_id : undefined
    const pageId = typeof args.page_id === 'string' ? args.page_id : undefined
    const document = manager.document(documentId)
    const result = await document.run(name, toolArgs, pageId)
    return { ok: true, result, target: document.target(pageId) }
  }
  throw new Error(`Unsupported OpenPencil command: ${command || '(empty)'}`)
}

async function createSession() {
  const server = new McpServer({ name: 'openpencil-mcp', version: '0.1.0' })
  let session: {
    server: McpServer
    transport: WebStandardStreamableHTTPServerTransport
    lastSeen: number
  }
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    enableJsonResponse: true,
    onsessioninitialized: (id) => {
      sessions.set(id, session)
    },
    onsessionclosed: (id) => {
      sessions.delete(id)
    }
  })
  session = { server, transport, lastSeen: Date.now() }
  registerTools(server, {
    policy: {
      allowEval: config.allowEval,
      disabledTools,
      scope: 'document'
    },
    mcpRoot: null,
    sendRPC,
    agentSession: { id: randomUUID(), kind: 'mcp' }
  })

  server.registerTool(
    'open_document',
    {
      description: 'Open a Cloud document in the live collaboration room.',
      inputSchema: toStandardJsonSchema(
        v.strictObject({
          document_id: v.pipe(v.string(), v.minLength(1), v.description('Document ID from list_documents'))
        })
      )
    },
    async ({ document_id }) => {
      try {
        const document = await manager.open(document_id)
        return ok({
          document: {
            id: document.id,
            name: document.name,
            pages: document.pages(),
            ...document.target()
          }
        })
      } catch (error) {
        return fail(error)
      }
    }
  )

  server.registerTool(
    'save_document',
    {
      description: 'Save the live document as a new Cloud revision.',
      inputSchema: toStandardJsonSchema(
        v.strictObject({
          document_id: v.optional(
            v.pipe(v.string(), v.description('Document ID; omit for the active document'))
          )
        })
      )
    },
    async ({ document_id }) => {
      try {
        const document = manager.document(document_id)
        const saved = await document.save(true)
        return ok({
          documentId: document.id,
          revisionId: saved?.currentRevisionId ?? null,
          version: saved?.version ?? null
        })
      } catch (error) {
        return fail(error)
      }
    }
  )

  server.registerTool(
    'list_workspaces',
    {
      description: 'List the Cloud workspaces available to the configured account.',
      inputSchema: toStandardJsonSchema(v.strictObject({}))
    },
    async () => {
      try {
        return ok({ workspaces: await manager.workspaces() })
      } catch (error) {
        return fail(error)
      }
    }
  )

  await server.connect(transport)
  return session
}

const sessions = new Map<
  string,
  {
    server: McpServer
    transport: WebStandardStreamableHTTPServerTransport
    lastSeen: number
  }
>()

setInterval(() => {
  const cutoff = Date.now() - 30 * 60_000
  for (const [id, session] of sessions) {
    if (session.lastSeen >= cutoff) continue
    sessions.delete(id)
    void session.transport.close().catch(() => undefined)
    void session.server.close().catch(() => undefined)
  }
}, 60_000).unref()

const app = new Hono()

app.get('/health', (context) =>
  context.json({
    status: 'ok',
    cloud: token.serverURL,
    openDocuments: manager.openDocuments().map((document) => ({
      id: document.id,
      name: document.name
    }))
  })
)

app.all('/mcp', async (context) => {
  if (!authorized(context.req.header('authorization'), context.req.header('x-mcp-token'))) {
    return context.json({ error: 'Unauthorized' }, 401)
  }
  const id = context.req.header('mcp-session-id')
  if (id) {
    const session = sessions.get(id)
    if (!session) return context.json({ error: 'MCP session not found' }, 404)
    session.lastSeen = Date.now()
    return session.transport.handleRequest(context.req.raw)
  }
  if (context.req.method !== 'POST') {
    return context.json({ error: 'Missing MCP session id' }, 400)
  }
  const session = await createSession()
  const response = await session.transport.handleRequest(context.req.raw)
  if (sessions.size === 0 || ![...sessions.values()].includes(session)) {
    await session.transport.close().catch(() => undefined)
    await session.server.close().catch(() => undefined)
  }
  return response
})

const httpServer = serve({ fetch: app.fetch, hostname: '0.0.0.0', port: config.port }, (info) => {
  console.log(`OpenPencil MCP listening on http://0.0.0.0:${info.port}/mcp`)
})

async function shutdown() {
  httpServer.close()
  await manager.closeAll().catch(() => undefined)
  for (const session of sessions.values()) {
    await session.transport.close().catch(() => undefined)
    await session.server.close().catch(() => undefined)
  }
  process.exit(0)
}

process.on('SIGINT', () => void shutdown())
process.on('SIGTERM', () => void shutdown())
