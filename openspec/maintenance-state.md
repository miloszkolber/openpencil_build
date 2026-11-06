# Maintenance state

## Scheduled dependency review

- Upstream OpenPencil releases are resolved by `scripts/resolve_release.py`.
- Docker base tags are maintained through Dependabot and resolved to linux/amd64 digests by `scripts/bases.py`.
- GitHub Actions are maintained through Dependabot.
- Runtime dependencies are refreshed with `bun update` inside the image build.

Record reviewed base-image or toolchain findings here when a weekly run cannot update an input automatically.
