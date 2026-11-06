# Change history

## 2026-11-06

Initial OpenPencil build from upstream mainline release source, with dependency refresh, unit tests, smoke verification and GHCR publication.

Daily release checks, `latest` as the newest mainline build, the distroless runtime, the `ghcr.io/miloszkolber/openpencil` package rename, and the preconfigured PostgreSQL/SeaweedFS/Mailpit stack were added in the same change.

Added the live Cloud MCP bridge under `mcp/`, which joins collaboration rooms with a headless graph and exposes the editor tool surface to remote MCP clients.
