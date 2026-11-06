# OpenPencil image

The image runs the OpenPencil Cloud server with the editor and portal pages it serves. It is built from an upstream release source archive, not from a published image or an npm package.

## Build inputs

| Input | Owner |
| --- | --- |
| OpenPencil release and commit | [`scripts/resolve_release.py`](../scripts/resolve_release.py) |
| Release source archive | [`scripts/fetch_source.py`](../scripts/fetch_source.py) |
| Base images and digests | [`scripts/bases.py`](../scripts/bases.py), [`Dockerfile`](Dockerfile) |
| Runtime dependency refresh | `bun update` in [`Dockerfile`](Dockerfile) |
| Build fingerprint | [`scripts/fingerprint.py`](../scripts/fingerprint.py) |
| Publication | [`scripts/publish.py`](../scripts/publish.py) |

The workflow checks the newest non-draft release by semver across stable and prerelease tags once a day. It rebuilds only when that release's version or `latest` tag is not already published. A relevant push or manual dispatch rebuilds on request. `bun update` refreshes direct and transitive dependencies within the ranges declared by the release, so the image is newer than the release's committed lockfile and is not bit-reproducible. Dependabot updates base tags within their current major versions; a major runtime or toolchain change is a reviewed manual change.

## Contents

The runtime is `gcr.io/distroless/nodejs22-debian12:nonroot`: Node 22 with no shell, package manager or extra OS tools, running as UID/GID 65532. It contains the standalone Cloud server, the built editor and portal site at `/app/site`, and the upstream Cloud license and notice. It serves on port 8787 and keeps `/tmp` available for runtime temporary files.

## Local build

```sh
python3 scripts/resolve_release.py --output .build/release.json
python3 scripts/fetch_source.py --release .build/release.json --destination .build/source
python3 scripts/bases.py --dockerfile cloud/Dockerfile \
  --output .build/bases.json --rewrite .build/Dockerfile
docker build --pull --file .build/Dockerfile \
  --tag ghcr.io/miloszkolber/openpencil:local .build/source
bash cloud/smoke.sh ghcr.io/miloszkolber/openpencil:local
```

The smoke script starts PostgreSQL, SeaweedFS, a bucket initializer and the candidate image, then checks `/health`, `/ready` and `/welcome`. It removes the stack and volumes afterward. Port 18787 on loopback must be free.

## Publication

The workflow publishes the exact release version and moves `latest` to the newest mainline release, including a prerelease. There is no `next` channel. A manual build of an older release publishes only its version tag and never moves `latest` backwards.

Scheduled runs skip a release whose version and `latest` tags already match the published digest. Version tags can be rebuilt by a relevant push or an explicit manual dispatch; use the manifest digest or the `io.openpencil-build.inputs` label for exact rollback. A new user-owned GHCR package starts private even when the repository is public. Set it to public once in the package settings if the workflow's anonymous pull fails; the workflow does not claim a successful publication when the package is not publicly pullable.

## Deployment and configuration

[`../deploy/`](../deploy/README.md) is a preconfigured one-machine stack with PostgreSQL, SeaweedFS, a bucket initializer and Mailpit. [`configuration.md`](configuration.md) lists the startup environment, secrets and TOML sections.

## Runtime notes

The server migrates its own tables at startup. A fresh database still needs the upstream Better Auth migration before sign-in works; follow the upstream self-hosting guide. This image keeps the upstream behavior rather than adding a migration entrypoint.
