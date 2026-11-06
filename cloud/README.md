# OpenPencil Cloud image

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

The workflow selects the newest non-draft release by semver across stable and prerelease tags. `bun update` refreshes direct and transitive dependencies within the ranges declared by the release. The resulting image is therefore newer than the release's committed lockfile and is not bit-reproducible.

## Contents

The runtime is Node 22 on Debian bookworm slim, runs as the unprivileged `node` user and serves on port 8787. It contains the standalone Cloud server, the built editor and portal site, and the upstream Cloud license and notice. It has no package manager and does not run as root.

## Local build

```sh
python3 scripts/resolve_release.py --output .build/release.json
python3 scripts/fetch_source.py --release .build/release.json --destination .build/source
python3 scripts/bases.py --dockerfile cloud/Dockerfile \
  --output .build/bases.json --rewrite .build/Dockerfile
docker build --pull --file .build/Dockerfile \
  --tag ghcr.io/miloszkolber/openpencil-cloud:local .build/source
bash cloud/smoke.sh ghcr.io/miloszkolber/openpencil-cloud:local
```

The smoke script starts PostgreSQL, SeaweedFS, a bucket initializer and the candidate image, then checks `/health`, `/ready` and `/welcome`. It removes the stack and volumes afterward. Port 18787 on loopback must be free.

## Publication

The workflow publishes the exact release version and, when applicable, `next` for the newest prerelease or `latest` for the newest stable release. It verifies the published manifest and labels before reporting success.

A new user-owned GHCR package starts private even when the repository is public. The workflow requests public visibility after publication. If that request is unavailable, set the package visibility in GitHub package settings before relying on anonymous pulls.

Version tags can be rebuilt by later scheduled runs. Use the manifest digest for rollback, and treat `io.openpencil-build.inputs` as the build-input identity.

## Runtime notes

The server migrates its own tables at startup. A fresh database still needs the upstream Better Auth migration before sign-in works; follow the upstream self-hosting guide. This image keeps the upstream behavior rather than adding a migration entrypoint.
