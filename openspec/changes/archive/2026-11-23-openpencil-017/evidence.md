# Evidence

## Inputs reviewed

- Last reviewed baseline: `v0.17.0-beta.5`, release id `446409550`, commit `e60fbae32e5f0e8ba6f7d59d9aeef14031249aa8`, published 2026-11-15T22:26:02Z.
- New upstream releases since the baseline: `v0.17.0-beta.6` (2026-11-19, commit `9de0016b71ac63556abdcdccd0f5e220cc85cc50`), `v0.17.0-beta.7` (2026-11-21, commit `99036deb55802e190067c08518e0046dc2e04681`) and stable `v0.17.0` (2026-11-22T12:35:42Z, release id `454432918`, commit `8524f1aa181aa7b28d8e5a3f5b3637b009af2d5f`).
- Release notes for all three releases, plus targeted source diffs between `e60fbae3` and `8524f1aa` for `packages/collab/src`, `packages/cloud/src/contract`, the Cloud TOML schema and the published MCP registry names.
- Upstream `nightly` is a rolling release with a non-semver tag. The resolver ignores it, so it remains unreviewed history rather than a build input. The beta.3 tag has no release record and was not reviewable through the releases API.
- Advisories: `bun audit` after the required `bun update` reports `nodemailer` 9.1.1 (eight moderate and two high address/SMTP parser issues fixed only in 10.x), `@hono/node-server` 1.19.x (moderate `serveStatic` path decoding, fixed in 2.1.3), `glob`/`minimatch` under `@vue-email/render` and nested `image-size` 1.2.1 under `pptxgenjs` (high DoS). The root `image-size` resolves to 2.1.0, which is outside the affected range. The bridge audit additionally reports `@hono/node-server` and nested `image-size`; no advisory is fixable inside the declared ranges.

## Release scheduling

- The 2026-11-22 scheduled run started at 12:35:16Z and finished in 11 seconds, after the resolver read `0.17.0-beta.7` as newest. `v0.17.0` was published 26 seconds later, so the run skipped a release that did not exist when it resolved. Published tags before this change were `0.17.0-beta.7` and `latest`.
- Manual dispatch of the Cloud workflow is the recorded way to close this gap; it does not change release policy.

## Cloud image candidate

- `scripts/resolve_release.py` selected `v0.17.0` with `newest_release=true` and `newest_stable=true`.
- Resolved linux/amd64 bases: `oven/bun:1.4.4@sha256:3f23864d3e8c…`, `rust:1-bookworm@sha256:198cd28b4ba9…`, `mcr.microsoft.com/playwright:v1.65.1-noble@sha256:766137e2d9ca…`, `gcr.io/distroless/nodejs22-debian12:nonroot@sha256:afa48e2ae110…`.
- Fingerprint: `f60711b1bfe8b339f4b8e6e779c944f2eaecbcf00b83c08a42ea2f3c1d2ef36c`.
- The candidate built from the resolved release archive. Rustup installed the release's `1.98.1` toolchain and `wasm32-unknown-unknown`, and `build:packages` built the new `@open-pencil/canvaskit`, `@open-pencil/std`, `@open-pencil/html-engine` and `@open-pencil/theme` packages.
- Cloud unit tests inside the build: 329 passed, 0 failed, 1651 expectations.
- `cloud/smoke.sh` passed for the local candidate: PostgreSQL, SeaweedFS, the bucket initializer and the server reported `/ready` and `/health`, and `/welcome` served HTML.
- Image inspection of the published `0.17.0`: distroless `nonroot`, UID/GID 65532, `/app/site` present, `server.mjs` and `services.mjs` present, no shell or package manager, image size 69.2 MB. Labels carry version `0.17.0`, upstream tag `v0.17.0`, commit `8524f1aa181aa7b28d8e5a3f5b3637b009af2d5f`, release id `454432918`, source revision `8f2cb0098dc24f47354f923d2a54c2879d275251` and fingerprint `ea00668b2c44c972544c80dcaf18eb8e4c0d64c80196dde0798270fdb4bf10cd`.
- The dispatch run published `0.17.0` and moved `latest` to manifest `sha256:787c2667cdcaed32468b95c1ff9fe5d3d7dc412051a63f330ceffd3675f4bc26`, then pulled it anonymously. The workflow run is `45118520420`.
- The bridge workflow published `sha-cef3ab61847a`, `0.1.0` and `latest` as manifest `sha256:c427824f66cc6bf1af4792ae9a389026f125ad31163b1ebf1c9e27a8334f0aef`, revision `cef3ab61847aca81b69a7f21d80d93a138ebf665`, and pulled all three anonymously. The workflow run is `45117589636`.

## MCP bridge

- `bun install` resolved `@open-pencil/cloud`, `core`, `mcp`, `scene-graph` and the new `std` dependency to `0.17.0`.
- `vendor/collab/` matches `packages/collab/src` at `v0.17.0` with no differences. The release changed `document/sync.ts` (optional `comments` room sync), and moved two imports to `@open-pencil/std/random` and `@open-pencil/std/arrays`.
- Unit tests in the built image, run one process per file as the workflow does: `live.test.ts` 2 passed, `cloud.test.ts` 3 passed, `auth.test.ts` 5 passed.
- The workflow's container smoke passed: `/health` returned `"status":"ok"` and an unauthenticated `POST /mcp` returned 401 with a read-only root, temporary `/tmp` and no capabilities. `/ready` returned 503 with unreachable Cloud and 200 against the disposable stack.

## Interaction with a disposable 0.17.0 Cloud stack

A disposable Compose project ran the local 0.17.0 candidate with PostgreSQL 17, SeaweedFS, Mailpit and loopback-only host ports. The account was created through email verification in Mailpit, and the bridges shared the server's network namespace so presigned object URLs resolved to the disposable SeaweedFS.

- `open_document` seeded an empty room from a stored `.pen` revision containing one frame and one rectangle; both arrived in the bridge's page tree.
- Tool listing returned 111 tools with `open_document`, `save_document`, `list_workspaces`, `create_shape` and `get_page_tree` present, and `get_selection`, `select_nodes`, `undo`, `redo`, `create_document` and `list_recent_documents` absent.
- A created ELLIPSE reached the saved revision; downloading that revision and loading it headlessly showed the seeded frame and the new ellipse.
- Two bridges opened the same document and saw each other's edits: the first bridge's page tree contained the second bridge's rectangle, and the second bridge's page tree contained the first bridge's ellipse.
- A save from the first bridge after both edits were in the room produced a revision containing the seed, the ellipse and the rectangle.
- A save from the second bridge, whose known base revision had moved, failed with HTTP 409 and wrote nothing; the newer revision stayed current.
- An external revision committed through the Cloud API while a bridge had the document open stayed current after that bridge's save failed with HTTP 409.
- After stopping both bridges and starting one again, `open_document` recovered the room's layers and a later save succeeded as version 3.
- Observed limit: the Cloud room snapshot is authoritative while it exists. An external revision written without joining the room is not merged into an open room; after a restart the bridge downloaded that revision as its base but applied the room state, and its later save produced a new revision from the room content. The save used the current revision as its base and did not overwrite a newer revision with a stale one.
- No credential was printed. The disposable project, volumes and data directories were removed after the checks.

## Upstream advisories

- `GHSA-6r2v-cq7x-fvh6` (medium, `@open-pencil/mcp` below `0.17.0-beta.6`) covers the desktop MCP server's `/rpc` and `/files` routes and its socket registration. The bridge exposes only `/mcp`, `/health` and `/ready` with one bearer token, so those routes do not exist here; the pinned `0.17.0` package also carries the client-token fix.
- `GHSA-x4rx-8c38-9hw8` (high, `@open-pencil/dom-css` below `0.17.0-beta.6`) is fixed by the release's scriptless HTML measuring frame. The Cloud image and the bridge packages resolve `0.17.0`.
- `GHSA-g2vj-wpg5-vqvh` (critical, `open-pencil` below `0.15.0`) covers the old public Trystero rooms. Cloud collaboration uses authenticated relay tickets, and the reviewed versions are above the patched range.

## Pipeline and documentation

- The MCP workflow resolves `oven/bun:1.4.4` to its linux/amd64 digest and builds the rewritten Dockerfile; a local run of `scripts/bases.py` and the rebuilt image succeeded.
- `dependabot.yml` now carries a weekly Docker entry for `mcp/` with a Bun-major ignore, matching the Cloud base policy.
- Dependabot's refreshed Compose groups proposed `postgres:19-alpine`, a major change the maintenance state keeps manual. Both Compose entries now ignore major PostgreSQL updates; the grouped pull requests that carried it were closed.
- `cloud/configuration.md` now documents `services.mjs`, `OPENPENCIL_SERVICES_CONFIG`, `OPENPENCIL_SERVICES_UPSTREAM_KEY`, `OPENPENCIL_CLOUD_SERVICES_SIGNING_KEY`, `GITHUB_CLIENT_SECRET`, `[services]`, `[entitlements.services]`, `[billing] endpoint` and the 0.17.0 document settings.
- Deferred: a browser-editor acceptance pass, natural session expiry, simultaneous seeding by several peers, and a full review of all 111 tool behaviors on 0.17.0.
