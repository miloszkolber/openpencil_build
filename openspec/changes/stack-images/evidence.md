# Evidence

## Inputs

- `chrislusf/seaweedfs:4.53` — `sha256:ccad23e18639c8b98cee17e7100b95830a06077b56d8e5b006d6dcf8ec5e94a0`.
- `amazon/aws-cli:2.40.3` — `sha256:33a16c53ea442e918b58df67301ad76a8fb57082c39f7e78753b898c3f3e87c2`.
- `axllent/mailpit:v1.33.1` — `sha256:aef2aacc11f075ec0fb6874275ee4a421e688e11a96ebb296134d1735c7761ce`.
- PostgreSQL stays on `postgres:17-alpine`.

## Smoke stack

`cloud/smoke.sh ghcr.io/miloszkolber/openpencil:0.17.0-beta.5` passed with SeaweedFS 4.53 and aws-cli 2.40.3: the bucket initializer created the bucket, `/ready` reported `ready`, `/health` reported `ok` and `/welcome` served HTML.

## Deployment stack

A fresh `deploy/compose.yaml` copy started on disposable loopback ports with the new images on 2026-11-16: PostgreSQL, SeaweedFS 4.53, the bucket initializer, Mailpit v1.33.1 and the beta.5 image reported `/ready` and served the welcome page. Mailpit reported version `v1.33.1`. An account was created through the email verification link, then a workspace and document were created through the Cloud API, which exercises SMTP delivery and object storage.

## Dependabot

`docker-compose` entries for `/deploy` and `/cloud` are added alongside the existing `docker` entry. GitHub only evaluates them on the next scheduled or manual Dependabot run; the next run's result is recorded in the maintenance state.

## Repository checks

- `python3 -m unittest discover -s tests`: passed.
- `bun scripts/check-docs.mjs` and `bun test scripts/check-docs.test.mjs`: no failures.
- `@fission-ai/openspec@1.16.0 validate --all --strict`: passed.
- `rhysd/actionlint:1.7.12`: no findings.
