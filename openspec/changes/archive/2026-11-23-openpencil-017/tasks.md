# Tasks

- [x] 1.1 Build the `0.17.0` candidate from the resolved release archive with pinned linux/amd64 bases; verified by the local `docker build` and the Cloud unit-test result of 329 passed, 0 failed.
- [x] 1.2 Smoke-test the candidate with PostgreSQL, SeaweedFS, the bucket initializer and the server; verified by `cloud/smoke.sh` reporting ready, healthy and an HTML welcome page.
- [x] 1.3 Inspect the built runtime image; verified by a distroless `nonroot` UID/GID 65532, `/app/site`, `server.mjs` and `services.mjs` present, and no package manager or shell.
- [x] 1.4 Publish `0.17.0` and `latest` through the Cloud workflow and verify an anonymous pull; verified by run `45118520420` and manifest `sha256:787c2667…`.
- [x] 2.1 Pin the bridge to the `0.17.0` packages and replace the vendored collaboration source; verified by a file diff against `packages/collab/src` at `v0.17.0` and `bun install` resolving every `@open-pencil` package to `0.17.0`.
- [x] 2.2 Add the bridge's new `@open-pencil/std` dependency and refresh `bun.lock`; verified by the unit tests in the built image.
- [x] 2.3 Run the bridge unit and container checks; verified by one process per test file and the `/health`, `/ready` and unauthenticated `401` container checks.
- [x] 2.4 Exercise the live room against a disposable `0.17.0` stack; verified by seeding, concurrent peer edits, a save holding both edits, stale-save and external-revision conflicts, and restart recovery.
- [x] 2.5 Resolve the bridge base to a linux/amd64 digest and monitor its tag through Dependabot; verified by the rewritten Dockerfile build and `dependabot.yml` review.
- [x] 3.1 Correct the configuration reference and deployment spec for the `0.17.0` services server, secrets and TOML sections; verified by the documentation checker.
- [x] 3.2 Run the required Python, documentation, OpenSpec and workflow checks; verified by the recorded commands and their results.
- [x] 3.3 Record the reviewed inputs, published identity and remaining advisories in the maintenance state and change history; verified by a review of the final diff.
- [x] 4.1 Merge the reviewed Dependabot Bun, stack and smoke image updates after their pull-request checks, and close the groups that carried a PostgreSQL major; verified by the merged commits `cef3ab6`, `174e26e`, `fea106f` and `8f2cb00` and their green runs.
