# Align the Cloud MCP bridge with OpenPencil 0.17.0-beta.5

## Why

Upstream released `v0.17.0-beta.5` on 2026-11-15. The bridge is pinned to `0.17.0-beta.2` packages with a vendored copy of that release's `@open-pencil/collab` source, and its README requires updating both when Cloud moves to another release.

Two beta.5 changes break the current pin when the bridge runs against the beta.5 image:

- `@open-pencil/core/io/formats/raster` no longer exports `initCanvasKit`, so the bridge crashes at startup when it builds the headless renderer.
- The `@open-pencil/mcp` registry registers a file-saving tool named `save_document` where it previously registered `save_file`, which collides with the bridge's own Cloud-revision `save_document` tool and aborts every MCP session.

The Cloud MCP capability is affected. No spec requirement changes: the bridge keeps its documented tool surface, credential separation and save semantics. This change records an implementation refresh only.

## What Changes

- Pin `@open-pencil/cloud`, `core`, `mcp` and `scene-graph` to `0.17.0-beta.5` and refresh `bun.lock`.
- Replace the vendored `@open-pencil/collab` copy with the beta.5 source and update its provenance notice.
- Take CanvasKit from `@open-pencil/core/canvaskit`, as upstream's headless host does.
- Hide the registry's app-only file tools, including its `save_document`, so the bridge keeps exposing its own Cloud `save_document`, `open_document` and `list_workspaces`.
- Answer the registry's renamed `close_document` RPC command; it was `close_file` in beta.2.
- State the new pin in the bridge README limits.

## Out of scope

- Upstream dependency advisories that are only fixable by an upstream major bump, such as `@hono/node-server` 1.x and nested `image-size` copies. They are recorded in the maintenance state instead.
- Publishing `latest` out of commit order for the MCP image, which stays in the backlog.
- Deployment or service restarts.

## Status

Implemented and verified against a disposable beta.5 Cloud stack. Publication is limited to a checked image from `main`.
