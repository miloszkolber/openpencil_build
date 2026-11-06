import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

export type CloudToken = {
  serverURL: string
  accessToken: string
  savedAt: string
}

export type AdapterConfig = {
  dataDir: string
  tokenFile: string
  cloudURL: string
  mcpToken: string | null
  workspaceId: string | null
  port: number
  saveDebounceMs: number
  agentName: string
  allowEval: boolean
}

function integer(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback
}

export function readConfig(environment = process.env): AdapterConfig {
  const dataDir = environment.OPENPENCIL_MCP_DATA_DIR?.trim() || '/data'
  return {
    dataDir,
    tokenFile: join(dataDir, 'cloud.json'),
    cloudURL: environment.OPENPENCIL_CLOUD_URL?.trim() || 'https://core.mewa.sh:8789',
    mcpToken: environment.OPENPENCIL_MCP_TOKEN?.trim() || null,
    workspaceId: environment.OPENPENCIL_WORKSPACE_ID?.trim() || null,
    port: integer(environment.PORT, 8790),
    saveDebounceMs: integer(environment.OPENPENCIL_MCP_SAVE_DEBOUNCE_MS, 3000),
    agentName: environment.OPENPENCIL_MCP_AGENT_NAME?.trim() || 'OpenCode MCP',
    allowEval: environment.OPENPENCIL_MCP_ALLOW_EVAL === '1'
  }
}

export async function readCloudToken(tokenFile: string): Promise<CloudToken | null> {
  try {
    const value: unknown = JSON.parse(await readFile(tokenFile, 'utf8'))
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const { serverURL, accessToken, savedAt } = value as Record<string, unknown>
    if (
      typeof serverURL !== 'string' ||
      typeof accessToken !== 'string' ||
      typeof savedAt !== 'string'
    ) {
      return null
    }
    return { serverURL, accessToken, savedAt }
  } catch {
    return null
  }
}

export async function writeCloudToken(tokenFile: string, token: CloudToken): Promise<void> {
  await mkdir(dirname(tokenFile), { recursive: true, mode: 0o700 })
  await writeFile(tokenFile, `${JSON.stringify(token, null, 2)}\n`, { mode: 0o600 })
}
