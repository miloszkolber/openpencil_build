# Project context

## Scope

`openpencil_build` publishes the OpenPencil container image built from upstream mainline release source and provides a preconfigured self-hosting stack.

| Deliverable | Source | Artifact |
| --- | --- | --- |
| OpenPencil image | `cloud/Dockerfile`, upstream release archive | `ghcr.io/miloszkolber/openpencil` |
| Build inputs | `scripts/resolve_release.py`, `scripts/bases.py`, `scripts/fingerprint.py` | Resolved JSON, fingerprint and OCI labels |
| Release pipeline | `.github/workflows/cloud.yml`, `scripts/publish.py` | Version tags and `latest` |
| Self-hosting stack | `deploy/`, `cloud/configuration.md` | PostgreSQL, SeaweedFS, bucket initializer and Mailpit |

Upstream OpenPencil owns the application, its release cadence and its runtime behavior. This repository owns the build recipe, resolved inputs, dependency refresh, checks, publication and the deployment example.

## Goals and boundaries

- Check the newest upstream mainline release, including prereleases, daily; rebuild only when it is not already published.
- Build from that release commit's source archive with refreshed dependencies and linux/amd64 base digests.
- Run the Cloud unit tests and a real server smoke stack before publication.
- Keep the runtime distroless and non-root, with `latest` tracking the newest mainline build.
- Provide a preconfigured local stack and a configuration reference without claiming production hardening.
- Keep publication separate from host deployment and keep the repository host-neutral.
- Make changes reviewable through requirements, scenarios and evidence.

The image is not bit-reproducible: `bun update` and base-image pulls resolve mutable inputs. Record the release commit, resolved bases, fingerprint and published digest for recovery.

## Owners

| Subject | Owner |
| --- | --- |
| Implemented behavior | `openspec/specs/<capability>/spec.md` alongside source |
| Proposed behavior, tasks and evidence | One scoped folder in `openspec/changes/` |
| Build and local commands | The affected README in `cloud/` or `scripts/` |
| Host-specific deployment, secrets and network | Local deployment docs, outside this repository; `deploy/` is a generic local example |
| OpenPencil application and release behavior | `open-pencil/open-pencil`, not this build repository |

Publication does not itself deploy. Keep tokens out of source, artifacts, labels and diagnostics.
