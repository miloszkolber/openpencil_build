# Cloud MCP bridge

## Purpose

Expose OpenPencil's editor tool surface to remote MCP clients by joining a Cloud document's live collaboration room with a headless graph.

Source: [MCP bridge](../../../mcp/README.md), [room session](../../../mcp/src/live.ts), [relay transport](../../../mcp/src/relay.ts), [MCP server](../../../mcp/src/server.ts). Checks: built-image health smoke, MCP initialization and tool-list checks, and live room seeding/edit verification.

## Requirements

### Requirement: Live Cloud room membership

The bridge SHALL join a Cloud document's collaboration relay as an editing peer and keep a headless `SceneGraph` synchronized with the room.

#### Scenario: Existing room

- **WHEN** a document with a stored room is opened
- **THEN** the bridge requests a collaboration ticket and joins the relay
- **AND** it applies the room's Yjs state to its graph
- **AND** it removes local layers that are not part of the room

#### Scenario: Empty room

- **WHEN** the joined room has no root
- **THEN** the bridge downloads the current Cloud revision
- **AND** it seeds the room from that graph, including document data and variables
- **AND** later peers receive the seeded document

#### Scenario: Local tool edit

- **WHEN** an MCP tool changes the graph
- **THEN** the change is written to the room's Yjs document
- **AND** connected editors receive it without a reload

### Requirement: Cloud authentication and document access

The bridge SHALL authenticate with the Cloud device flow and access documents through the Cloud API.

#### Scenario: Login

- **WHEN** the login command runs
- **THEN** it requests a device code, prints the verification URL and code, and polls for the token
- **AND** it stores the token with mode `0600`

#### Scenario: Document listing and opening

- **WHEN** an MCP client lists workspaces or documents
- **THEN** the bridge returns the account's Cloud workspaces and documents
- **AND** opening a document downloads and assembles its revision and image sidecars

#### Scenario: Saving

- **WHEN** a document is saved explicitly or after the quiet period
- **THEN** the bridge writes a `.fig` revision and its image sidecars
- **AND** it retries a revision conflict against the latest Cloud revision

### Requirement: MCP tool surface

The bridge SHALL expose the document-scoped OpenPencil tool registry and bridge-specific discovery tools.

#### Scenario: Tool list

- **WHEN** an MCP client initializes
- **THEN** document, structure, variable, export, layout and analysis tools are available
- **AND** app-only selection, tab, settings and undo/redo tools are omitted
- **AND** `open_document`, `save_document` and `list_workspaces` are available

#### Scenario: MCP authentication

- **WHEN** a request reaches `/mcp` without the configured bearer token
- **THEN** the server returns 401
- **AND** `/health` remains unauthenticated and reports status only

### Requirement: Session and deployment boundaries

The bridge SHALL keep Cloud and MCP credentials separate and state its stopgap limits.

#### Scenario: Runtime containment

- **WHEN** the bridge container runs
- **THEN** it can run read-only with a temporary `/tmp`
- **AND** the Cloud token lives in its data volume and the MCP token in deployment secrets

#### Scenario: Documented limits

- **WHEN** an operator reads the bridge README
- **THEN** it explains the seven-day Cloud session, room restore behavior, image-byte transport and the pinned upstream version
