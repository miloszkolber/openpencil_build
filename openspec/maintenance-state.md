# Maintenance state

## Scheduled dependency review

- Upstream OpenPencil releases are checked daily by `scripts/resolve_release.py`; a build runs only when the version or `latest` is not already published.
- Docker base tags are maintained through Dependabot and resolved to linux/amd64 digests by `scripts/bases.py`.
- GitHub Actions and the deployment and smoke Compose image tags are maintained through Dependabot.
- Runtime dependencies are refreshed with `bun update` inside each image build.

Record reviewed base-image or toolchain findings here when a scheduled run cannot update an input automatically.

- The daily `04:17` schedule observed so far actually starts between `11:00` and `13:00` UTC, and no scheduled run starts when the newest release is already published. A release published late in the day is therefore not built or published until the next delayed run; a manual dispatch of the same workflow covers the gap without changing policy.
- `deploy/` and `cloud/smoke.compose.yml` now use `chrislusf/seaweedfs:4.53`, `amazon/aws-cli:2.40.3` and `axllent/mailpit:v1.33.1`, and grouped `docker-compose` Dependabot entries cover both directories. PostgreSQL stays on `17-alpine`; a new major remains a reviewed manual change.
- Upstream declares `@hono/node-server` `^1.19.17` and `image-size` `^2.0.4`, so the required `bun update` cannot leave the `1.x` line or reach the advisory-free `image-size` range for every nested copy. `bun audit` in the bridge image reports `@hono/node-server` 1.19.18 (moderate, `serveStatic` path decoding, not used by the bridge or Cloud's server), nested `image-size` 1.2.1 inside `pptxgenjs` (high, DoS through malformed image headers), `nodemailer` 9.1.1 (moderate and high address-parser DoS) and `glob`/`minimatch`/`deepmerge` (moderate and low). These need an upstream release or a deliberate override, and a release build must not patch around them.

## Cloud image review

- Refreshing `@iconify-json/lucide` from 1.2.139 to 1.2.153 moved `square-arrow-out-up-right` from a concrete icon to an alias. The upstream demo client reads only concrete icons, so `build:cloud` failed after the required dependency refresh. The local build recipe resolves demo icons using Iconify's alias-aware utility. The rebuilt image passed 213 Cloud unit tests and the isolated service smoke stack.
- Reviewed `v0.17.0-beta.5` on 2026-11-16. The release keeps the `rust-toolchain.toml` `1.98.1`/`wasm32-unknown-unknown` build and adds a prebuilt `packages/taffy` fork release, so no new toolchain is needed. The candidate passed 292 Cloud unit tests and the smoke stack, and the checked image was published. Published identity for recovery: `0.17.0-beta.5` and `latest` are manifest `sha256:3ad5e13687b7fa3b1b9ad2160ae518b6c05c6f6794ea19fb22933f8e87af3907`, upstream commit `e60fbae32e5f0e8ba6f7d59d9aeef14031249aa8`, fingerprint `5777e609ab53f9ca4be19be6c4949bd9ca893bc5f5b9f3d10d071a2be1051268`.
- Four scheduled runs failed from 2026-11-12 to 2026-11-15 because the release needed Cargo and the builder had none; `0cb5668` added the build-only Rust toolchain and the following push run published beta.4.

## MCP bridge review

- The original save path rebased an unchanged snapshot onto a newer Cloud revision after a conflict. The local correction uses the bridge's known revision and reports conflicts instead. A disposable Cloud document test confirmed that an external revision makes a stale bridge save fail without changing that revision. Two headless peers exchanged edits in both directions and a saved revision contained both edits.
- A successful image build and startup health check do not establish collaboration or durable-save correctness.
- Reviewed `v0.17.0-beta.5` on 2026-11-16. The bridge moved from `0.17.0-beta.2` to beta.5 packages and vendored collaboration source. Two beta.5 changes break a naive bump: the raster module dropped `initCanvasKit`, and the MCP registry now registers `save_document` and `close_document` where beta.2 had `save_file` and `close_file`. The bridge takes CanvasKit from `@open-pencil/core/canvaskit`, hides the registry's app-only file tools and answers `close_document`.
- Verified against a disposable beta.5 stack: room seeding from a stored revision, concurrent edits in both directions, a save holding both edits, a stale save and a save after an external revision both rejected with 409 without overwriting, recovery after restarting the bridge, and the renamed `close_document` command.
- Verified in Playwright Chromium against the disposable beta.5 stack: the editor loads a Cloud document, a shape created through the bridge appears in the layer panel without a reload, an arrow-key nudge made in the browser changes the node the bridge reads, and the change survives a bridge restart after a saved revision.
- A server `minimum_editor_version` of `99.0.0` returned `426 editor_outdated` for a request naming `0.17.0-beta.5` and refused the browser editor, while the bridge opened, edited and saved because it names no editor version. This matches the upstream support boundary for MCP clients.
- At the account's storage limit the collaboration ticket reports `permission: view` with `readOnly: storage-limit`; the bridge refuses to open the document with a view-only message and attempts no write.
- The bridge sends only binary relay frames. The beta.5 relay heartbeat is a text `ping` the bridge never sends, and the beta.4 relay accepts the bridge without it.
- The published bridge image (`latest` manifest `sha256:65b5b97e8354c7da98cc5d4f0ecebadb5243acf9d759d88efa8c5e84f7f35955`) also ran against the published beta.4 image: open, create, save, an external revision, a stale-save conflict and restart recovery all behaved as on beta.5.
- `scripts/publish_mcp.py` writes `sha-<commit>` and moves `latest` and `0.1.0` only for an equal or descendant commit, so an older or unrelated build cannot move the aliases.
- Not verified: browser editing through the OpenChamber desktop panel, natural session expiry against beta.5, and simultaneous room seeding by several peers.
