# openpencil_build

OpenPencil image built from upstream mainline release source and published to GHCR as `latest` plus version tags.

| Deliverable | Source | Image |
| --- | --- | --- |
| OpenPencil | [`cloud/Dockerfile`](cloud/Dockerfile), upstream release archive | `ghcr.io/miloszkolber/openpencil` |
| Local stack | [`deploy/compose.yaml`](deploy/compose.yaml) | PostgreSQL, SeaweedFS, bucket initializer, Mailpit |

## Build and release

The image workflow checks for a new upstream release every day at 04:17 UTC. It also builds on relevant pushes to `main`, on pull requests and on manual dispatch.

Each check resolves the newest non-draft OpenPencil release by semver across stable and prerelease tags, then downloads that release commit's source archive. A beta newer than the latest stable is eligible. A scheduled run rebuilds only when that release's version or `latest` tag is missing; an unchanged release is reported and skipped. Manual dispatch can pin any published tag, including a beta, and always rebuilds on request.

The build refreshes dependencies instead of trusting the release lockfile alone. It runs `bun update`, which keeps every dependency within the ranges declared by the release, then runs the Cloud unit tests before building the packages and server. Base images are resolved to linux/amd64 digests on every build. Dependabot proposes weekly updates for GitHub Actions and Docker base tags within their current major versions; major runtime changes are manual.

A candidate must pass the Cloud unit tests and a real smoke stack with PostgreSQL, SeaweedFS and the built server before publication. The smoke stack checks `/health`, `/ready` and the `/welcome` page.

Publication writes the exact release version (`0.17.0-beta.2`, for example) and moves `latest` to the newest mainline release, including a beta. A manual build of an older release publishes only its version tag and never moves `latest` backwards. The runtime is a distroless Node 22 image with no shell or package manager.

Pull requests build and smoke-test without logging in or publishing. Publication is not deployment.

## Self-hosting

[`deploy/`](deploy/README.md) starts the image with preconfigured PostgreSQL, SeaweedFS, bucket initialization and Mailpit. [`cloud/configuration.md`](cloud/configuration.md) documents the startup variables, secrets and TOML sections.

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

`.build/` is generated and ignored. Never commit a release archive or a refreshed lockfile. The upstream project owns OpenPencil behavior; this repository owns only the build recipe, resolved inputs, checks and publication.

## Documentation

[`openspec/`](openspec/README.md) is the planning tree: implemented contracts, deferred work and maintenance notes. [`cloud/README.md`](cloud/README.md) owns image and build details.
