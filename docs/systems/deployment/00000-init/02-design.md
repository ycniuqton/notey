# Deployment — Design (00000-init)

## Strategy matrix
```
                     persists notes?  inbound port?   best for
node (bare)          yes (local FS)   yes             local dev / quick try
pm2                  yes (local FS)   yes             long-lived VPS / bare-metal
docker + compose     yes (volume)     yes             any host with Docker
cloudflare tunnel    yes (local FS)   NO (outbound)   public URL, no port-forward
ngrok                yes (local FS)   NO (outbound)   quick public demo
fly.io / render      yes (volume)     platform TLS    managed container hosting
railway              yes (volume)     platform TLS    managed (uses Dockerfile)
vercel / workers     NO on disk       n/a             needs KV repo (not shipped)
```
All non-serverless paths reuse the same server unchanged; only `NOTEY_STORE` and the
public-exposure mechanism differ.

## Files added
```
Dockerfile                 node:20-alpine, non-root, HEALTHCHECK, zero deps, CMD node
.dockerignore              keep image tiny (no node_modules/docs/.git/note-store)
docker-compose.yml         notey service + notey-data volume; optional cloudflared (profile: tunnel)
ecosystem.config.cjs       PM2: name notey, fork mode, 1 instance, autorestart, mem cap
scripts/setup.sh           auto-detect + dispatch: node | pm2 | docker | tunnel
deploy/cloudflared/config.example.yml   named-tunnel config (ingress -> localhost:8080)
fly.toml                   Fly.io: internal 8080, /data volume, force_https
render.yaml                Render: docker runtime, disk mounted at /data
.env.example               all NOTEY_* knobs + CLOUDFLARE_TUNNEL_TOKEN
package.json (root)        project manifest + scripts; devlens moved to devDependencies
LICENSE / CONTRIBUTING.md  MIT + contributor guide
.github/workflows/ci.yml   node --check all files + start/health/stop smoke test
```

## setup.sh flow
```
./setup.sh [mode]
└─ no mode → detect: docker? → suggest docker; else node present → suggest node
└─ ensure .env (copy from .env.example if missing)
└─ mode = node    → assert node ≥ 18 → exec node backend/src/server.js
└─ mode = pm2     → pm2 present? (else tell how to install) → pm2 start ecosystem.config.cjs
└─ mode = docker  → docker + compose present? → docker compose up -d --build
└─ mode = tunnel  → assert app reachable on $NOTEY_PORT (start if not)
                    └─ cloudflared installed? → quick tunnel (trycloudflare URL)
                                                or named tunnel if config present
└─ unknown mode   → print usage, exit 2
```

## Docker runtime
```
docker compose up -d
└─ build image from Dockerfile (copies backend/ + frontend/, no npm install)
└─ run as non-root user `notey`
└─ NOTEY_STORE=/data  ← mounted named volume notey-data (persists across redeploys)
└─ EXPOSE 8080, publish host:8080 → container:8080
└─ HEALTHCHECK GET / every 30s
--- optional public exposure ---
docker compose --profile tunnel up -d
└─ + cloudflared sidecar, TUNNEL_TOKEN from .env
   └─ dashboard maps public hostname → http://notey:8080 (container network)
```

## Cloudflare Tunnel (named) flow
```
one-time: cloudflared tunnel login → create → route dns
run:
cloudflared tunnel --config deploy/cloudflared/config.example.yml run
└─ outbound connection to Cloudflare edge (no inbound firewall change)
└─ ingress: hostname notey.example.com → service http://localhost:8080
└─ TLS terminated at Cloudflare edge
```

## TLS / HTTPS options
```
public HTTPS for notey — three ways, pick by where DNS lives:
├─ Cloudflare Tunnel   → domain on Cloudflare → Universal SSL is automatic + free,
│                        certificate managed at the edge, nothing to install/renew
├─ Fly.io / Render     → platform issues + renews the certificate automatically
└─ Let's Encrypt       → domain NOT on Cloudflare, own public IP (ports 80/443 open)
   (deploy/nginx/notey.conf + certbot)
   trigger: sudo certbot --nginx -d notey.space
   └─ HTTP-01 challenge on :80 → cert issued → certbot rewrites nginx to :443 + redirect
   └─ systemd timer auto-renews (~every 60 days)
   └─ notey bound to 127.0.0.1; nginx forwards X-Forwarded-Proto/For (rate limits keep real IP)
```

## Persistence & scaling notes
```
storage = NOTEY_STORE (default ./note-store)
├─ bare/pm2 → a real directory on the host
├─ docker   → named volume mounted at /data
└─ fly/render → attached volume mounted at /data
scaling: ONE instance per store.
├─ multiple PM2 cluster workers → in-memory rate-limit state diverges + write races
└─ multiple containers/replicas → same problem → NOT supported (single replica only)
```

## Shared server / existing reverse proxy (field-verified)
Real deployments often land on a box that ALREADY has a reverse proxy on 80/443 fronting
other apps. Binding notey to 80 is wrong there. Verified pattern (deployed behind an
existing Caddy that also fronts Chatwoot):
```
build image on host → run notey container on the PROXY's docker network
  (no published host port; proxy reaches it by container name)
└─ append a vhost to the proxy config, keyed by hostname:
     http://notey.example.com { reverse_proxy notey:8080 }
   ├─ back up the config first
   ├─ validate  → invalid → restore backup, do NOT reload  (protects other sites)
   └─ valid     → graceful reload (no restart; existing sites keep serving)
└─ Cloudflare: proxied A record + SSL mode "Flexible"  (origin stays HTTP :80)
   └─ http:// (not https://) avoids a redirect loop with Flexible
notes: proxy must forward client IP (X-Forwarded-For / CF-Connecting-IP) or notey's
       rate limits key on the proxy IP. Update flow: scripts/redeploy.sh with
       NOTEY_NETWORK=<proxy_net>.
```

## Serverless extension point (why Vercel is not shipped)
```
Vercel/Workers request → new isolate, ephemeral/read-only FS
└─ FileNoteRepository.save() → data lost on next cold start ✗
fix (future): implement KvNoteRepository extends NoteRepository, select in server.js
              bootstrap via env (Rule 15). API/domain/frontend unchanged.
```
