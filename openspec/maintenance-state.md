# Maintenance state

## Scheduled dependency review

- Upstream OpenPencil releases are checked daily by `scripts/resolve_release.py`; a build runs only when the version or `latest` is not already published.
- Docker base tags are maintained through Dependabot and resolved to linux/amd64 digests by `scripts/bases.py`.
- GitHub Actions are maintained through Dependabot.
- Runtime dependencies are refreshed with `bun update` inside each image build.

Record reviewed base-image or toolchain findings here when a scheduled run cannot update an input automatically.
