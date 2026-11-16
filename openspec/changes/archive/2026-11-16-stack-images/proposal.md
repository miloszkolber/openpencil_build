# Refresh the deployment and smoke stack images

## Why

`deploy/compose.yaml` and `cloud/smoke.compose.yml` pinned SeaweedFS `4.41`, `amazon/aws-cli:2.27.49` and Mailpit `v1.31.0` while newer image tags had been published for weeks. Dependabot did not cover either Compose file: the `docker` ecosystem reads `cloud/Dockerfile`, not the Compose manifests, so the examples drifted without a review signal.

The deployment capability owns the stack example. This change only refreshes image inputs and their monitoring; it does not change the stack's behavior or contract.

## What Changes

- Build the smoke and deployment stacks with `chrislusf/seaweedfs:4.53`, `amazon/aws-cli:2.40.3` and `axllent/mailpit:v1.33.1`.
- Add `docker-compose` Dependabot entries for `/deploy` and `/cloud`, grouped weekly, so the example images are proposed for review instead of drifting.

## Out of scope

- PostgreSQL stays on the supported `17-alpine` moving tag, which Dependabot's existing `docker` entry for `/cloud` does not manage. Moving to a new PostgreSQL major needs its own reviewed change.
- Deployment or service restarts. The host stack keeps its current images until an operator deploys.

## Status

Implemented. Verified by the smoke stack and a fresh deployment stack with account creation through Mailpit.
