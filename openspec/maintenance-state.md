# Maintenance state

## Scheduled dependency review

- Upstream OpenPencil releases are checked daily by `scripts/resolve_release.py`; a build runs only when the version or `latest` is not already published.
- Docker base tags are maintained through Dependabot and resolved to linux/amd64 digests by `scripts/bases.py`.
- GitHub Actions are maintained through Dependabot.
- Runtime dependencies are refreshed with `bun update` inside each image build.

Record reviewed base-image or toolchain findings here when a scheduled run cannot update an input automatically.

## Cloud image review

- Refreshing `@iconify-json/lucide` from 1.2.139 to 1.2.153 moved `square-arrow-out-up-right` from a concrete icon to an alias. The upstream demo client reads only concrete icons, so `build:cloud` failed after the required dependency refresh. The local build recipe resolves demo icons using Iconify's alias-aware utility. The rebuilt image passed 213 Cloud unit tests and the isolated service smoke stack.

## MCP bridge review

- The original save path rebased an unchanged snapshot onto a newer Cloud revision after a conflict. The local correction uses the bridge's known revision and reports conflicts instead. A disposable Cloud document test confirmed that an external revision makes a stale bridge save fail without changing that revision. Two headless peers exchanged edits in both directions and a saved revision contained both edits. Browser editing, conflict recovery, simultaneous room seeding and interrupted saves have not been verified.
- A successful image build and startup health check do not establish collaboration or durable-save correctness. The bridge's published image is not changed by this local correction.
- The bridge pins the upstream collaboration implementation. Its compatibility with subsequent Cloud releases and session renewal need separate verification.
