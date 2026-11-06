# Self-hosted OpenPencil stack

A preconfigured one-machine stack: the OpenPencil image, PostgreSQL, SeaweedFS for S3-compatible storage, a bucket initializer, and Mailpit for captured email. It binds to loopback only.

## Start

```sh
cd deploy
cp .env.example .env
# Replace POSTGRES_PASSWORD and BETTER_AUTH_SECRET. Use URL-safe values.
# Replace S3_SECRET_ACCESS_KEY in both .env and seaweedfs/s3.json if you change it.
docker compose --env-file .env up -d --wait
```

Open `http://localhost:8787`. Sign-up verification mail and password resets appear in Mailpit at `http://localhost:8025`.

`OPENPENCIL_IMAGE` selects the image. Use `ghcr.io/miloszkolber/openpencil:<version>` for a pinned release or `:latest` for the newest mainline build, including betas.

## Services

| Service | Purpose | Address |
| --- | --- | --- |
| `openpencil` | Server, API, editor and portal pages | `127.0.0.1:8787` |
| `seaweedfs` | S3-compatible storage, sharing the server's network namespace | `127.0.0.1:8333` |
| `bucket` | Creates the `openpencil` bucket once SeaweedFS is healthy | None |
| `postgres` | Accounts, workspaces, documents, revisions and entitlements | Internal only |
| `mailpit` | Captured SMTP and web inbox | `127.0.0.1:8025` |

The server and SeaweedFS share a network namespace so the browser's presigned uploads and the server's S3 calls both use `http://localhost:8333`. PostgreSQL and Mailpit are reached by service name inside the Compose network. This is a one-machine try-out arrangement. For remote users, expose the object store at a stable HTTPS hostname, set `object_storage.endpoint` and `public_url` to the addresses browsers use, and configure the bucket's CORS rules for the editor origin.

## First administrator

Startup never grants roles. Enroll the first account in the UI, then run the operator command from a matching source checkout:

```sh
cd ..   # repository root
# Use the same release tag as OPENPENCIL_IMAGE.
python3 scripts/resolve_release.py --tag <tag> --output .build/release.json
python3 scripts/fetch_source.py --release .build/release.json --destination .build/source
set -a; . deploy/.env; set +a
docker run --rm --user "$(id -u):$(id -g)" --network openpencil-stack_default \
  -v "$PWD/.build/source:/src" -w /src \
  -v "$PWD/deploy/openpencil.toml:/etc/openpencil/openpencil.toml:ro" \
  -e HOME=/tmp -e BUN_INSTALL_CACHE_DIR=/tmp/bun-cache \
  -e OPENPENCIL_CLOUD_CONFIG=/etc/openpencil/openpencil.toml \
  -e DATABASE_URL="postgresql://openpencil:${POSTGRES_PASSWORD}@postgres:5432/openpencil" \
  -e BETTER_AUTH_SECRET="$BETTER_AUTH_SECRET" \
  -e S3_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID" -e S3_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY" \
  oven/bun:1.4.4 sh -lc 'bun install --frozen-lockfile && bun --filter @open-pencil/cloud admin approve <email> && bun --filter @open-pencil/cloud admin grant <email>'
```

After the first account is granted, set `authentication.enrollment.mode = "closed"` (or `"approval"`) in `openpencil.toml` and restart the stack:

```sh
docker compose --env-file .env up -d --wait --force-recreate
```

Recreate the whole stack rather than only `openpencil`: SeaweedFS shares the server's network namespace, so recreating the server alone would leave it on a stale namespace.

## Configuration

[`openpencil.toml`](openpencil.toml) is the deployment configuration. It uses the fixed development credentials for local use. For a public server, change at least:

- `deployment.public_url` and the reverse proxy/TLS setup;
- `POSTGRES_PASSWORD`, `BETTER_AUTH_SECRET`, `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` in `.env`;
- the SeaweedFS credentials in `seaweedfs/s3.json` to match;
- `authentication.passkeys.enabled = true` only behind a stable HTTPS origin;
- `authentication.enrollment.mode` and any provider or email settings.

See [configuration](../cloud/configuration.md) for every environment variable and TOML section, and the upstream self-hosting guide for reverse-proxy, object-store CORS and Cloudflare Workers guidance.

## Operations

Back up the `postgres` and `seaweedfs` volumes together. Migrations run before the server accepts requests and only move forward, so restore the database backup to roll back.

This stack is a local starting point, not a public production deployment. Do not expose it until you have replaced the development credentials, terminated TLS in front of the server and object store, and reviewed the upstream hardening checklist.
