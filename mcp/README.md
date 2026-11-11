# OpenPencil MCP bridge

A long-running MCP server that joins an OpenPencil Cloud document's collaboration room as an editing peer. It exposes the OpenPencil editor tool surface to MCP clients such as opencode, and edits appear live in the browser editor.

## How it works

- Authenticates to Cloud with a device-authorization token.
- Downloads the document's current `.fig` revision and opens its Yjs room through the Cloud relay.
- Seeds an empty room from the stored revision; joins an existing room without replacing its document.
- Uses the MCP tool registry from `@open-pencil/mcp` with a headless graph backend instead of a desktop app.
- Saves a new Cloud revision after a quiet period (`OPENPENCIL_MCP_SAVE_DEBOUNCE_MS`, default 3 s) or explicitly through `save_document`. A conflicting revision fails the save rather than overwriting newer data. Reconcile changes before reopening the document.
- App-only tools such as selection, undo/redo, settings and tab activation are disabled. Document tools, variables, structure, exports and `eval` (when enabled) work live.

## Login

Cloud sessions can expire. Run the login command and approve the device code in a browser:

```sh
docker volume create openpencil-mcp-data
docker run --rm -it -v openpencil-mcp-data:/data \
  -e OPENPENCIL_CLOUD_URL=https://cloud.example.com \
  openpencil-mcp bun src/login.ts
```

The token is written to `/data/cloud.json` with mode `0600`. If tools start failing with HTTP 401, run the login command again.

For optional unattended reauthentication, provision a dedicated workspace editor and place a JSON object with `email` and `password` in `/data/credentials.json`, readable only by the bridge user (mode `0600`). The bridge checks the Cloud session on startup and every five minutes. When the session is invalid, it signs in, checks the resulting identity, and atomically replaces the stored token. It never retries a document mutation. Sign-in requiring an additional factor cannot complete unattended and is reported as an error. Store this credential separately from the MCP bearer token and never commit it.

`/health` is a process liveness check. `/ready` returns 503 while Cloud authentication is unchecked or its latest check failed, and 200 when the latest check succeeded. A network failure does not cause credential-based sign-in or overwrite the saved token.

## Run

```sh
docker run -d --name openpencil-mcp --restart unless-stopped \
  --read-only --tmpfs /tmp:size=64m,mode=1777 \
  --cap-drop ALL --security-opt no-new-privileges:true \
  -p 127.0.0.1:8790:8790 \
  -v openpencil-mcp-data:/data \
  -e OPENPENCIL_MCP_TOKEN=replace-with-a-random-token \
  -e OPENPENCIL_CLOUD_URL=https://cloud.example.com \
  openpencil-mcp
```

| Variable | Purpose |
| --- | --- |
| `OPENPENCIL_CLOUD_URL` | Cloud base URL used for API calls and relay tickets. |
| `OPENPENCIL_MCP_DATA_DIR` | Data directory, default `/data`; holds `cloud.json`. |
| `OPENPENCIL_MCP_TOKEN` | Required bearer token for the MCP endpoint. |
| `PORT` | Listen port, default `8790`. |
| `OPENPENCIL_MCP_SAVE_DEBOUNCE_MS` | Quiet period before an automatic Cloud revision, default `3000`. |
| `OPENPENCIL_MCP_AGENT_NAME` | Name shown in room presence, default `OpenCode MCP`. |
| `OPENPENCIL_MCP_ALLOW_EVAL` | `1` enables the `eval` tool. |

## MCP client

```jsonc
"openpencil": {
  "type": "remote",
  "url": "http://127.0.0.1:8790/mcp",
  "oauth": false,
  "headers": {
    "Authorization": "Bearer {file:/path/to/mcp-token}"
  }
}
```

Use `list_workspaces`, `list_documents`, then `open_document`. Standard tools accept `document_id` and optional `page_id`; `save_document` forces a revision.

## Limits

- The adapter is a live collaboration peer, not the desktop app: it has no selection, tabs, settings or local file dialog.
- It writes image bytes through the Yjs room rather than Cloud image references; large image-heavy documents can grow the room. The stored revision still splits images normally.
- A document restore moves the room to a new epoch. The adapter closes that room; open the document again.
- `open_document` downloads the current revision before joining, so opening a large document takes as long as that download and headless load.
- The adapter is pinned to OpenPencil `0.17.0-beta.2`; update its package versions and vendored collaboration source when Cloud moves to another release.

## Development

```sh
cd mcp
bun install
OPENPENCIL_CLOUD_URL=https://cloud.example.com \
OPENPENCIL_MCP_TOKEN=local \
OPENPENCIL_MCP_DATA_DIR=/tmp/openpencil-mcp \
bun src/login.ts
bun src/server.ts
```

`vendor/collab/` is the MIT `@open-pencil/collab` source from the matching upstream release. It is not published to npm.
