# openpencil_build

Weekly OpenPencil Cloud image built from upstream mainline release source and published to GHCR as `latest`, `next` and version tags.

| Deliverable | Source | Image |
| --- | --- | --- |
| OpenPencil Cloud | [`cloud/Dockerfile`](cloud/Dockerfile), upstream release archive | `ghcr.io/miloszkolber/openpencil-cloud` |

## Build and release

The image workflow runs every Monday at 04:47 UTC, on relevant pushes to `main`, on pull requests and on manual dispatch.

Each run resolves the newest non-draft OpenPencil release by semver across stable and prerelease tags, then downloads that release commit's source archive. A beta that is newer than the latest stable is selected. Manual dispatch can pin any published tag, including a beta. A release published between Monday runs is built on the next run or immediately by manual dispatch.

The build refreshes dependencies instead of trusting the release lockfile alone. It runs `bun update`, which keeps every dependency within the ranges declared by the release, then runs the Cloud unit tests before building the packages and server. Base images are resolved to linux/amd64 digests on every run. Dependabot proposes weekly updates for GitHub Actions and Docker base tags within their current major versions; major runtime changes are manual.

A candidate must pass the Cloud unit tests and a real smoke stack with PostgreSQL, SeaweedFS and the built server before publication. The smoke stack checks `/health`, `/ready` and the `/welcome` page.

Publication writes the exact release version (`0.17.0-beta.2`, for example), `next` for the newest prerelease and `latest` only for the newest stable release. Version tags are rebuilt by later weekly runs when their dependencies or bases change; use the registry digest or the `io.openpencil-build.inputs` label for exact rollback. A manual build of an older release publishes only its version tag and never moves `latest` backwards.

Pull requests build and smoke-test without logging in or publishing. Publication is not deployment.

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

`.build/` is generated and ignored. Never commit a release archive or a refreshed lockfile. The upstream project owns OpenPencil behavior; this repository owns only the build recipe, resolved inputs, checks and publication.

## Documentation

[`openspec/`](openspec/README.md) is the planning tree: implemented contracts, deferred work and maintenance notes. [`cloud/README.md`](cloud/README.md) owns image and build details.
