# Deployment — Requirements (00000-init)

## Summary
Make notey a self-hostable open-source project that deploys easily on any modern
platform, with a one-command setup and first-class support for Docker, PM2, and
tunnels (Cloudflare Tunnel / ngrok). Preserve the app's defining trait: a
**zero-dependency** Node server that stores notes on the **local filesystem**.

## Functional
- FR1: `scripts/setup.sh` — one entry point that auto-detects tooling and runs notey
  via the best available method, or an explicit mode: `node | pm2 | docker | tunnel`.
- FR2: Docker image (no build step, zero deps) + `docker-compose.yml` with a named
  volume for persistent notes.
- FR3: PM2 process file (`ecosystem.config.cjs`) for VPS/bare-metal, single instance.
- FR4: Cloudflare Tunnel + ngrok paths to expose a local instance publicly with no
  inbound ports; a compose `tunnel` profile runs cloudflared as a sidecar.
- FR5: PaaS manifests for container platforms with volumes: `fly.toml`, `render.yaml`
  (Railway works via the Dockerfile).
- FR6: `.env.example` documents every config knob; root `package.json` exposes
  `start` / `dev` / `docker:*` / `pm2:*` scripts.

## Open-source hygiene
- FR7: MIT `LICENSE`, `CONTRIBUTING.md`, `.gitignore`, `.dockerignore`, a rewritten
  deployment-focused `README.md`, and a lightweight CI (`node --check` + smoke test).

## Constraints
- C1: No new runtime dependencies — the app must still start with only Node ≥ 18.
- C2: Notes persist across restarts/redeploys — every strategy mounts or maps
  `NOTEY_STORE` to durable storage.
- C3: Single logical instance per store — filesystem storage + in-memory rate limits
  mean cluster/multi-replica is unsupported (documented, not enforced).
- C4: Secrets (tunnel tokens) come from env, never committed.

## Serverless (documented, not implemented)
- Vercel / Cloudflare Workers cannot persist to disk. The `NoteRepository` base class
  is the extension point for a KV/blob store; README explains the tradeoff and how to
  add one. Not shipped in this version.

## Out of scope
Kubernetes manifests, Terraform/IaC, multi-region, managed-DB storage backends.
