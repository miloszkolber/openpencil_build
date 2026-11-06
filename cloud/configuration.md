# Configuration

OpenPencil Cloud reads a TOML deployment file and a small set of environment variables. The same file drives the Node server, the operator commands and the Cloudflare Worker. This page summarises the settings most operators change; the upstream [self-hosting guide](https://openpencil.dev/reference/self-hosting-cloud) is the full reference.

## Startup environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `OPENPENCIL_CLOUD_CONFIG` | Yes | Path to the deployment TOML file. |
| `OPENPENCIL_CLOUD_SITE_DIR` | In the image | Directory containing the built editor and portal pages. The published image sets `/app/site`; leave it unset when using the image. |
| `OPENPENCIL_CLOUD_DEV_SITE_URL` | No | Development only: serve pages from a Vite dev server instead of `OPENPENCIL_CLOUD_SITE_DIR`. |
| `PORT` | No | Listen port, default `8787`. |
| `HOST` | No | Listen address, default `0.0.0.0`. |

The server is ready at `GET /ready`; `/health` reports process health. Database migrations run before the server accepts requests.

## Secrets

Every secret can be supplied through the environment variable named in the TOML. A TOML value can also name a different variable with `{ from_env = "CUSTOM_NAME" }`.

| Variable | Used when |
| --- | --- |
| `DATABASE_URL` | Always. PostgreSQL 15 or later; the server migrates before accepting requests. |
| `BETTER_AUTH_SECRET` | Always. At least 32 characters. |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Always. S3-compatible object storage. |
| `S3_SESSION_TOKEN` | Optional temporary S3 credentials. |
| `OPENPENCIL_CLOUD_SMTP_USER`, `OPENPENCIL_CLOUD_SMTP_PASSWORD` | Optional SMTP authentication. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | `[authentication.providers.google]`. |
| `APPLE_PRIVATE_KEY` | `[authentication.providers.apple]`; the other Apple identifiers are plain TOML values. |
| `TURNSTILE_SECRET_KEY` | `[authentication.captcha]` with the Cloudflare Turnstile provider. |
| `OPENPENCIL_CLOUD_AI_SIGNING_KEY` | `[ai]`; PKCS #8 PEM P-256 key used to sign AI tokens. |
| `OPENPENCIL_CLOUD_SERVICE_TOKEN` | `[internal_api]`; bearer token for the internal entitlement API. |
| `POSTHOG_PROJECT_API_KEY` | `[error_tracking]` unless the TOML names a different variable. |

A missing required secret stops startup and names the variable without printing its value. Never put secrets directly in TOML, image layers, Compose files or build arguments.

## TOML sections

The TOML file uses `schema_version = 2`. Tables are strict: an unknown key stops startup instead of being ignored.

| Section | Useful settings |
| --- | --- |
| `[deployment]` | `mode` (`self-hosted` or `official`), `public_url`, `indexing` (`allow`/`deny`), `trusted_origins`, `local_editor`, optional `listing.minimum_editor_version`. |
| `[database]` | Optional `url` reference; defaults to `DATABASE_URL`. |
| `[authentication]` | `secret` reference; enrollment mode `open`, `approval` or `closed`; admin notification emails. |
| `[authentication.email_password]` | `enabled`, `sign_up`, password length bounds, verification/reset link lifetimes, compromised-password check. Enabling it requires transactional email. |
| `[authentication.mfa]` | `required_for_admins`, `totp`, `recovery_codes`, trusted-device lifetime. |
| `[authentication.passkeys]` | `enabled` and `rp_name`; passkeys belong to `public_url`'s origin, so use a stable HTTPS address. |
| `[authentication.captcha]` | Cloudflare Turnstile `site_key`, `secret_key` reference and allowed hostnames. |
| `[authentication.trusted_proxies]` | Trusted client-IP headers and proxy addresses, for example `cf-connecting-ip` behind Cloudflare. |
| `[authentication.providers.google]` | Google client ID and secret reference. |
| `[authentication.providers.apple]` | Apple client, team and key identifiers plus private-key reference. |
| `[object_storage]` | `endpoint`, `region`, `bucket`, credential references, `force_path_style`, `checksum_verification` (`metadata` for SeaweedFS/Garage), optional server-side encryption and `maximum_upload_bytes`. |
| `[collaboration]` | Optional `relay_url`, maximum message bytes and connections per room. |
| `[documents]` | `retention_days` for deleted-document recovery. |
| `[email]` | `transport = "none"`, `"smtp"` or `"cloudflare"`; `from`; SMTP host, port, `secure` and credential references. |
| `[workers.email]` | Outbox batch size, interval, lease and maximum attempts. |
| `[workers.cleanup]` | Cleanup `enabled`, batch size, interval and lease. Set `enabled = false` when an external scheduler runs the cleanup command. |
| `[entitlements]` | `source = "static"` with limits below, or `"database"` for per-workspace limits managed by the operator. |
| `[entitlements.documents]` | `maximum_file_bytes`, `revision_history`. |
| `[entitlements.storage]` | `maximum_bytes`. |
| `[entitlements.sharing]` | `links`, `guest_view`, `guest_edit`, `guest_presence`. |
| `[entitlements.collaboration]` | `enabled`, `maximum_participants`. |
| `[entitlements.ai]` | `enabled`, optional `monthly_credit_allowance`. |
| `[ai]` | Optional `endpoint`, signing-key reference and token lifetime; the service receives short-lived signed tokens. Cloud never proxies models. |
| `[billing]` | Optional `portal_url` linked from the account and plan pages. |
| `[internal_api]` | Optional service-token reference for services such as billing that set workspace entitlements. Cannot be combined with static entitlements. |
| `[error_tracking]` | Optional PostHog error reporting: `provider = "posthog"`, `host`, project-key reference. |

## Useful profiles

Local try-out: `local_editor = true`, enrollment `open`, email-password enabled with Mailpit SMTP, passkeys disabled, object storage `checksum_verification = "metadata"`, static entitlements. The [deployment stack](../deploy/README.md) starts from this profile.

Private team server: `local_editor = false`, enrollment `approval` or `closed`, guest sharing disabled under `[entitlements.sharing]`, stable HTTPS `public_url`, passkeys enabled, and a reverse proxy that forwards WebSocket upgrades for `/api/collaboration/relay`.

Public service: `mode = "official"` adds the upstream constraints: email-password sign-up requires compromised-password checks and CAPTCHA, SMTP must use a secure connection, and the AI endpoint must use HTTPS. Review the upstream self-hosting and security guidance before exposing a server publicly.

## AI relay

The image also contains `ai-relay.mjs`, a minimal OpenAI-compatible relay. It uses its own TOML file:

| Variable | Purpose |
| --- | --- |
| `OPENPENCIL_AI_RELAY_CONFIG` | Path to the relay TOML file. |
| `OPENPENCIL_AI_RELAY_UPSTREAM_KEY` | Upstream provider API key. |
| `DATABASE_URL` | Shared Cloud database or a separate database for the relay. |
| `PORT` | Relay listen port, default `8788`. |

Run it with `docker run … ghcr.io/miloszkolber/openpencil ai-relay.mjs` (the distroless entrypoint is Node). The relay's model catalog, prices and concurrency limits live in its TOML file; see the upstream `openpencil-ai-relay.example.toml`.

## Image and distroless notes

The runtime image is `gcr.io/distroless/nodejs22-debian12:nonroot`: Node 22, no shell, no package manager. The server runs as UID/GID 65532 and reads its site from `/app/site`. Mount the TOML file read-only and set `OPENPENCIL_CLOUD_CONFIG`; runtime filesystem writes outside `/tmp` fail.

## First administrator and operator commands

Startup never grants roles. Enroll the first account, then run the operator command from a matching source checkout:

```sh
bun --filter @open-pencil/cloud admin approve owner@example.com
bun --filter @open-pencil/cloud admin grant owner@example.com
```

The other commands are `migrate`, `cleanup`, `quota:reconcile` and `entitlements`. They read the same configuration and secrets as the server. The distroless image does not include Bun or the source checkout, so run them from a checkout or a separate Bun container.
