# Change history

## 2026-11-23

Published OpenPencil `0.17.0`, the stable release the 2026-11-22 schedule missed by 26 seconds, and recorded the published identity. The Cloud runtime remains distroless non-root and now includes the release's services server.

Moved the Cloud MCP bridge to the `0.17.0` packages and vendored collaboration source, pinned its base image to a resolved linux/amd64 digest, and verified seeding, concurrent edits, save conflicts and restart recovery against a disposable 0.17.0 stack. Corrected the configuration reference for the 0.17.0 services server and TOML sections, and kept major PostgreSQL updates manual in Dependabot. See [the archived change](changes/archive/2026-11-23-openpencil-017/evidence.md).

## 2026-11-16

Kept the MCP image aliases moving forward: the workflow now publishes an immutable commit tag and moves `latest` and `0.1.0` only for an equal or descendant commit. See [the archived change](changes/archive/2026-11-16-mcp-image-tags/evidence.md).

Refreshed the deployment and smoke stack images to SeaweedFS 4.53, aws-cli 2.40.3 and Mailpit 1.33.1, and added Compose Dependabot updates for both directories. See [the archived change](changes/archive/2026-11-16-stack-images/evidence.md).

Moved the Cloud MCP bridge from OpenPencil `0.17.0-beta.2` to `0.17.0-beta.5`, including its vendored collaboration source, and repaired the two beta.5 breaks: the removed `initCanvasKit` export and the registry's renamed file tools. Verified against a disposable beta.5 Cloud stack. See [the archived change](changes/archive/2026-11-16-mcp-beta5/evidence.md).

## 2026-11-15

Added a build-only Rust toolchain for release-source HTML engine WebAssembly builds. The builder honors the release's toolchain declaration while the runtime remains distroless. See [the archived change](changes/archive/2026-11-15-cloud-wasm-build/evidence.md) for verification and compatibility limits.

## 2026-11-11

Added optional service-account reauthentication for the Cloud MCP bridge, atomic token replacement, dynamic use of refreshed credentials and an authentication readiness check. Verified revocation recovery in an open disposable room and after deployment. See [the archived change](changes/archive/2026-11-11-mcp-reauth/evidence.md).

## 2026-11-06

Initial OpenPencil build from upstream mainline release source, with dependency refresh, unit tests, smoke verification and GHCR publication.

Daily release checks, `latest` as the newest mainline build, the distroless runtime, the `ghcr.io/miloszkolber/openpencil` package rename, and the preconfigured PostgreSQL/SeaweedFS/Mailpit stack were added in the same change.

Added the live Cloud MCP bridge under `mcp/`, which joins collaboration rooms with a headless graph and exposes the editor tool surface to remote MCP clients.
