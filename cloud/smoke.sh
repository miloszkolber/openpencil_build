#!/usr/bin/env bash
set -euo pipefail
image="${1:?Usage: cloud/smoke.sh IMAGE}"
directory="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project="${OPENPENCIL_SMOKE_PROJECT:-openpencil-smoke-${GITHUB_RUN_ID:-$$}}"
export OPENPENCIL_CLOUD_IMAGE="$image"

cleanup() {
  status=$?
  if [ "$status" -ne 0 ]; then
    docker compose -p "$project" -f "$directory/smoke.compose.yml" logs --no-color >&2 || true
  fi
  docker compose -p "$project" -f "$directory/smoke.compose.yml" down --volumes --remove-orphans >/dev/null 2>&1 || true
  exit "$status"
}
trap cleanup EXIT

docker compose -p "$project" -f "$directory/smoke.compose.yml" up \
  --detach --wait --wait-timeout 300

ready=false
for _ in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:18787/ready | grep -q '"status":"ready"'; then
    ready=true
    break
  fi
  sleep 2
done
if [ "$ready" != true ]; then
  echo 'OpenPencil Cloud did not become ready' >&2
  exit 1
fi

curl -fsS http://127.0.0.1:18787/health | grep -q '"status":"ok"'
curl -fsS -H 'Accept: text/html' http://127.0.0.1:18787/welcome | grep -qi '<!doctype html'
echo "OpenPencil Cloud smoke check passed for $image"
