# Project context

## Scope

`openpencil_build` publishes the OpenPencil Cloud container image built from upstream mainline release source.

| Deliverable | Source | Artifact |
| --- | --- | --- |
| OpenPencil Cloud image | `cloud/Dockerfile`, upstream release archive | `ghcr.io/miloszkolber/openpencil-cloud` |
| Build inputs | `scripts/resolve_release.py`, `scripts/bases.py`, `scripts/fingerprint.py` | Resolved JSON, fingerprint and OCI labels |
| Release pipeline | `.github/workflows/cloud.yml`, `scripts/publish.py` | Version tags, `latest` and `next` |

Upstream OpenPencil owns the application, its release cadence and its runtime behavior. This repository owns the build recipe, resolved inputs, dependency refresh, checks and publication.

## Goals and boundaries

- Track the newest upstream mainline release, including prereleases, and build from that release commit's source archive.
- Refresh project dependencies within the release's declared ranges and resolve base images to linux/amd64 digests on every weekly build.
- Run the Cloud unit tests and a real server smoke stack before publication.
- Keep publication separate from host deployment and keep the repository host-neutral.
- Make changes reviewable through requirements, scenarios and evidence.

The image is not bit-reproducible: `bun update` and base-image pulls resolve mutable inputs. Record the release commit, resolved bases, fingerprint and published digest for recovery.

## Owners

| Subject | Owner |
| --- | --- |
| Implemented behavior | `openspec/specs/<capability>/spec.md` alongside source |
| Proposed behavior, tasks and evidence | One scoped folder in `openspec/changes/` |
| Build and local commands | The affected README in `cloud/` or `scripts/` |
| Host deployment, secrets, storage and network | Local deployment docs, outside this repository |
| OpenPencil application and release behavior | `open-pencil/open-pencil`, not this build repository |

Publication does not itself deploy. Keep tokens out of source, artifacts, labels and diagnostics.
