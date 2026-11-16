# Evidence

## Inputs reviewed

- Upstream `v0.17.0-beta.5`: release id `446409550`, commit `e60fbae32e5f0e8ba6f7d59d9aeef14031249aa8`, published 2026-11-15T22:26:02Z, npm `next` at `0.17.0-beta.5`. The previous reviewed baseline was `v0.17.0-beta.4`.
- Upstream collaboration contract and `packages/collab` diff between `v0.17.0-beta.2`, `v0.17.0-beta.4` and `v0.17.0-beta.5`. The Yjs document schema, relay frame codes and `RELAY_SERVER_PEER` are unchanged. Beta.5 adds an optional ticket `readOnly: 'storage-limit'` marker, an optional `relayHeartbeat` flag and a text `ping`/`pong` heartbeat that only the relay answers. Beta.5's collaboration changes are editor-side graph API changes (`runOutsideEdits`, `willChange*`, `layerImageHashes`) and do not alter the wire format.
- Beta.5 release notes: `TextAutoResize` drops `TRUNCATE`, `initCanvasKit` disappears from the raster module, the headless CSS runtime is removed, the MCP registry renames `save_file` to `save_document` and `close_file` to `close_document`, and Cloud can advertise a minimum editor version.

## Cloud image candidate

- `scripts/resolve_release.py` selected `v0.17.0-beta.5` with `newest_release=true`.
- Resolved linux/amd64 bases: `oven/bun:1.4.4@sha256:3f23864d…`, `rust:1-bookworm@sha256:198cd28b…`, `mcr.microsoft.com/playwright:v1.65.0-noble@sha256:f6fe3cf9…`, `gcr.io/distroless/nodejs22-debian12:nonroot@sha256:afa48e2a…`. Fingerprint `5777e609ab53f9ca4be19be6c4949bd9ca893bc5f5b9f3d10d071a2be1051268`.
- The candidate built from the resolved release archive. `cargo 1.98.1` installed from the release `rust-toolchain.toml`, `packages/html-engine/wasm/html-engine.wasm` was compiled, and the runtime stayed distroless.
- Cloud unit tests inside the build: 292 passed, 0 failed.
- `cloud/smoke.sh` passed: PostgreSQL, SeaweedFS, the bucket initializer and the candidate reported `/ready`, `/health` and an HTML `/welcome`.
- The image labels carry `org.opencontainers.image.version=0.17.0-beta.5`, `io.openpencil-build.upstream.tag=v0.17.0-beta.5` and the resolved commit.

## MCP bridge

- `bun install` resolved all four `@open-pencil` packages to `0.17.0-beta.5`; the built image reports those versions.
- `vendor/collab/` matches `packages/collab/src` at `v0.17.0-beta.5` with no differences.
- Unit tests in the built image, run as the workflow does with one process per file: `live.test.ts` 2 passed, `cloud.test.ts` 3 passed, `auth.test.ts` 5 passed.
- The workflow's container smoke passed: `/health` returned `"status":"ok"` and an unauthenticated `POST /mcp` returned 401 with a read-only container, temporary `/tmp` and no capabilities.

## Interaction with a disposable beta.5 Cloud stack

A disposable Compose project ran the beta.5 candidate with PostgreSQL 17, SeaweedFS 4.41 and Mailpit on loopback-only ports, an account created through email verification, and two bridge containers sharing the server's network namespace.

- `open_document` seeded the empty room from the stored revision and pages and layers arrived.
- Tool listing returned 111 tools with `open_document`, `save_document` and `list_workspaces` present, and `get_selection`, `undo`, `redo`, `get_settings` and `create_document` absent.
- Each peer's shape reached the other peer without a reload: the bridge that created `B shape` appeared in the other bridge's page tree as well as `A shape`.
- A save from the peer holding the current base revision succeeded as version 5 and included both shapes.
- A save from the peer whose base revision had moved failed with HTTP 409 and wrote nothing; the newer revision stayed current.
- An external revision committed through the Cloud API while a bridge had a document open stayed current after that bridge's save failed with HTTP 409.
- After stopping both bridges and starting one again, `open_document` loaded the stored revision with both shapes, and a later save succeeded as version 7.
- `close_document` answered through the renaming and closed the open document without writing an empty revision when nothing had changed.
- No credential was printed; tokens stayed in the disposable data volumes and environment files, which were removed.

## Repository checks

- `python3 -m unittest discover -s tests`: 25 tests passed.
- `bun scripts/check-docs.mjs`: 23 Markdown files, 0 failures.
- `bun test scripts/check-docs.test.mjs`: 8 passed.
- `@fission-ai/openspec@1.16.0 validate --all --strict`: 4 specs passed.
- `rhysd/actionlint:1.7.12`: no findings.

## Not verified

- Browser editing against the beta.5 Cloud, the beta.5 `readOnly: 'storage-limit'` ticket marker, relay heartbeats from older relays, and long outages remain unexercised.
- A minimum editor version configured on the server is not enforced by the bridge, which sends no editor version during discovery.
- The published image digests and CI results are recorded after publication by the workflow, not by this run.
