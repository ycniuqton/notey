#!/usr/bin/env sh
# notey setup — one command to run notey the easiest available way.
#
#   ./scripts/setup.sh            auto-detect and run
#   ./scripts/setup.sh node       run directly with Node
#   ./scripts/setup.sh pm2        run under PM2 (long-lived)
#   ./scripts/setup.sh docker     build + run with Docker Compose
#   ./scripts/setup.sh tunnel     run + expose publicly via Cloudflare Tunnel
#   ./scripts/setup.sh help
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PORT="${NOTEY_PORT:-8080}"

log()  { printf '\033[35m[notey]\033[0m %s\n' "$1"; }
die()  { printf '\033[31m[notey] %s\033[0m\n' "$1" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

ensure_env() {
  [ -f .env ] && return 0
  if [ -f .env.example ]; then cp .env.example .env; log "Created .env from .env.example"; fi
}

assert_node() {
  have node || die "Node.js not found. Install Node >= 18: https://nodejs.org"
  major="$(node -p 'process.versions.node.split(".")[0]')"
  [ "$major" -ge 18 ] || die "Node >= 18 required (found $(node -v))."
}

run_node() {
  assert_node
  log "Starting notey on http://localhost:$PORT  (Ctrl+C to stop)"
  exec node backend/src/server.js
}

run_pm2() {
  assert_node
  have pm2 || die "PM2 not found. Install it with:  npm install -g pm2"
  pm2 start ecosystem.config.cjs
  pm2 save
  log "notey is running under PM2 on port $PORT. Logs:  pm2 logs notey"
}

run_docker() {
  have docker || die "Docker not found. Install Docker: https://docs.docker.com/get-docker/"
  docker compose version >/dev/null 2>&1 || die "Docker Compose v2 not found (need 'docker compose')."
  docker compose up -d --build
  log "notey is running in Docker on http://localhost:$PORT"
  log "Public URL via Cloudflare Tunnel:  CLOUDFLARE_TUNNEL_TOKEN=... docker compose --profile tunnel up -d"
}

run_tunnel() {
  have cloudflared || die "cloudflared not found: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
  start_local_if_needed
  if [ -f deploy/cloudflared/config.yml ]; then
    log "Starting named Cloudflare Tunnel (config.yml)…"
    exec cloudflared tunnel --config deploy/cloudflared/config.yml run
  fi
  log "Opening a public quick tunnel to http://localhost:$PORT …"
  exec cloudflared tunnel --url "http://localhost:$PORT"
}

start_local_if_needed() {
  if curl -sf -o /dev/null "http://127.0.0.1:$PORT/" 2>/dev/null; then
    log "Found notey already running on port $PORT."
    return 0
  fi
  assert_node
  log "notey not running — starting it in the background…"
  node backend/src/server.js >/tmp/notey-tunnel.log 2>&1 &
  NOTEY_BG_PID=$!
  trap 'kill "$NOTEY_BG_PID" 2>/dev/null || true' EXIT INT TERM
  sleep 1
}

detect_and_run() {
  ensure_env
  if have docker && docker compose version >/dev/null 2>&1; then
    log "Docker detected — recommended: ./scripts/setup.sh docker"
  fi
  log "Running directly with Node. For other modes: ./scripts/setup.sh help"
  run_node
}

usage() {
  sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'
}

MODE="${1:-auto}"
case "$MODE" in
  auto)   detect_and_run ;;
  node)   ensure_env; run_node ;;
  pm2)    ensure_env; run_pm2 ;;
  docker) ensure_env; run_docker ;;
  tunnel) ensure_env; run_tunnel ;;
  help|-h|--help) usage ;;
  *) usage; die "Unknown mode: $MODE" ;;
esac
