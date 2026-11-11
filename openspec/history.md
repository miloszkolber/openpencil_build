# Change history

## 2026-11-11

Added optional service-account reauthentication for the Cloud MCP bridge, atomic token replacement, dynamic use of refreshed credentials and an authentication readiness check. Verified revocation recovery in an open disposable room and after deployment. See [the archived change](changes/archive/2026-11-11-mcp-reauth/evidence.md).

## 2026-11-06

Initial OpenPencil build from upstream mainline release source, with dependency refresh, unit tests, smoke verification and GHCR publication.

Daily release checks, `latest` as the newest mainline build, the distroless runtime, the `ghcr.io/miloszkolber/openpencil` package rename, and the preconfigured PostgreSQL/SeaweedFS/Mailpit stack were added in the same change.

Added the live Cloud MCP bridge under `mcp/`, which joins collaboration rooms with a headless graph and exposes the editor tool surface to remote MCP clients.
