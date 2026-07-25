#!/usr/bin/env sh
# Pull the latest code and rebuild + restart the notey Docker container.
#
#   ./scripts/redeploy.sh
#
# Environment (override for your host):
#   NOTEY_NETWORK        docker network to join (e.g. behind an existing reverse
#                        proxy: NOTEY_NETWORK=chatwoot_default). Unset = default bridge.
#   NOTEY_PORT_PUBLISH   host port to publish, e.g. 80 (standalone). Unset = no publish
#                        (correct when a reverse proxy reaches the container by name).
#   NOTEY_VOLUME         data volume name (default: notey-data).
set -eu

cd "$(dirname "$0")/.."
VOLUME="${NOTEY_VOLUME:-notey-data}"

echo "[notey] pulling latest…"
git pull --ff-only

echo "[notey] building image…"
docker build -t notey:latest .

echo "[notey] recreating container…"
docker rm -f notey 2>/dev/null || true
docker run -d --name notey --restart unless-stopped \
  ${NOTEY_NETWORK:+--network "$NOTEY_NETWORK"} \
  ${NOTEY_PORT_PUBLISH:+-p "$NOTEY_PORT_PUBLISH":8080} \
  -v "$VOLUME":/data \
  -e NOTEY_HOST=0.0.0.0 -e NOTEY_PORT=8080 -e NOTEY_STORE=/data \
  notey:latest

docker image prune -f >/dev/null 2>&1 || true
echo "[notey] redeployed at $(git rev-parse --short HEAD) — notes preserved in volume '$VOLUME'"
