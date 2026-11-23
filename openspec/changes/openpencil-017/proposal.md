# Adopt OpenPencil 0.17.0

## Why

Upstream published the stable `v0.17.0` release on 2026-11-22T12:35:42Z. The daily 04:17 UTC schedule actually runs between 11:00 and 13:00 UTC, and the 2026-11-22 run started at 12:35:16Z, 26 seconds before the release existed. It skipped the then-current `0.17.0-beta.7`, so the stable release has no published image.

The Cloud MCP bridge is pinned to `0.17.0-beta.5`. The stable release changes room and document encoding: shared rooms record document data in a new format, `.fig` layers keep the file's GUIDs, text metrics become value objects, and several `@open-pencil/*` import paths change. A beta.5 bridge cannot share a room with a 0.17.0 editor, and its own pinned packages resolve the old schema.

The deployment configuration reference also still names the removed `ai-relay.mjs` and `OPENPENCIL_AI_RELAY_*` variables, `[ai]`, `OPENPENCIL_CLOUD_AI_SIGNING_KEY` and `[billing] portal_url`. Current upstream uses `services.mjs`, `OPENPENCIL_SERVICES_*`, `[services]`, `OPENPENCIL_CLOUD_SERVICES_SIGNING_KEY` and `[billing] endpoint`.

The affected capabilities are OpenPencil image, release pipeline, deployment and Cloud MCP. Publication remains separate from deployment.

## What Changes

- Build and publish the OpenPencil `0.17.0` image from upstream commit `8524f1aa181aa7b28d8e5a3f5b3637b009af2d5f`.
- Pin the MCP bridge to the `0.17.0` packages, replace the vendored `@open-pencil/collab` source with that release's source, and add its new `@open-pencil/std` dependency.
- Resolve the bridge's `oven/bun` base to a linux/amd64 digest in the MCP workflow and let Dependabot propose base-tag updates for `mcp/`.
- Keep PostgreSQL on its current major in both Compose groups; Dependabot proposed `19-alpine` and now ignores major PostgreSQL updates for those directories.
- Correct the configuration reference for the 0.17.0 services server and TOML sections, and update the deployment spec's reference scenario.
- Record the reviewed upstream releases, published identity and remaining advisories in the maintenance state.

## Out of scope

- Deployment or service restarts. Publication does not authorize either.
- Advisories that need an upstream major bump: `nodemailer` 9.1.1, `@hono/node-server` 1.x, `glob`/`minimatch` under `@vue-email/render`, and the nested `image-size` 1.2.1 under `pptxgenjs`. They stay recorded in the maintenance state.
- A browser-editor acceptance pass for 0.17.0. The Cloud unit tests, image inspection, smoke stack and MCP live-room checks are the executed evidence.

## Status

Implemented. The Cloud candidate passed its unit tests, smoke stack and image inspection; the bridge passed its unit, container and live-room checks against a disposable 0.17.0 stack.
