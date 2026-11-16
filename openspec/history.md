# Change history

## 2026-11-16

Moved the Cloud MCP bridge from OpenPencil `0.17.0-beta.2` to `0.17.0-beta.5`, including its vendored collaboration source, and repaired the two beta.5 breaks: the removed `initCanvasKit` export and the registry's renamed file tools. Verified against a disposable beta.5 Cloud stack. See [the change](changes/mcp-beta5/evidence.md).

## 2026-11-15

Added a build-only Rust toolchain for release-source HTML engine WebAssembly builds. The builder honors the release's toolchain declaration while the runtime remains distroless. See [the archived change](changes/archive/2026-11-15-cloud-wasm-build/evidence.md) for verification and compatibility limits.

## 2026-11-11

Added optional service-account reauthentication for the Cloud MCP bridge, atomic token replacement, dynamic use of refreshed credentials and an authentication readiness check. Verified revocation recovery in an open disposable room and after deployment. See [the archived change](changes/archive/2026-11-11-mcp-reauth/evidence.md).

## 2026-11-06

Initial OpenPencil build from upstream mainline release source, with dependency refresh, unit tests, smoke verification and GHCR publication.

Daily release checks, `latest` as the newest mainline build, the distroless runtime, the `ghcr.io/miloszkolber/openpencil` package rename, and the preconfigured PostgreSQL/SeaweedFS/Mailpit stack were added in the same change.

Added the live Cloud MCP bridge under `mcp/`, which joins collaboration rooms with a headless graph and exposes the editor tool surface to remote MCP clients.
