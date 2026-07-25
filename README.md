# notey

A minimalist, self-hostable web notepad where **the URL path is the note**. Visit any
path (e.g. `notey.space/usera/file1`) to open it; typing autosaves to disk. No accounts,
no database, no build step. Optional per-note password protection.

- **Zero runtime dependencies** — the backend runs on Node ≥ 18 alone (built-in
  `http`/`fs`/`crypto`). No `npm install` needed to run it.
- **The URL is the note** — any path creates/opens a note; nested paths are just folders.
- **Autosave · markdown preview · light/dark · word counts**, ported from the design.
- **Password-lockable notes** (scrypt-hashed, unrecoverable).
- **Hardened**: strict path-traversal defense, brute-force + write rate limits,
  security headers, size/abuse caps. See [Security](#security).

```
┌───────────────────────────────────────────────┐
│ notey.space/  kitchen-rebuild      Copy link   │  ● Saved
├───────────────────────────────────────────────┤
│  # Kitchen rebuild — notes                      │
│  Dropped the second quote in here so it stops   │
│  living in my inbox.                            │
└───────────────────────────────────────────────┘
  42 words · 231 characters · 9 lines   The URL is the note.
```

## Quick start

```bash
git clone <your-repo-url> notey && cd notey
./scripts/setup.sh            # auto-detects tooling and runs notey
# → open http://localhost:8080
```

`setup.sh` accepts an explicit mode: `node` · `pm2` · `docker` · `tunnel` (see below).
Or use npm scripts: `npm start`, `npm run dev`, `npm run docker:up`, `npm run pm2:start`.

## Repository layout

```
frontend/     static SPA (React via CDN, no build step)
backend/      Node server — zero dependencies
note-store/   notes saved here — one JSON file per note, mirroring the URL path
docs/         feature & system documentation
scripts/      setup.sh
deploy/       platform helper configs (cloudflared, …)
Dockerfile · docker-compose.yml · ecosystem.config.cjs · fly.toml · render.yaml
```

## Configuration

All optional — copy `.env.example` to `.env` (setup.sh does this for you).

| Var              | Default          | Meaning                                        |
|------------------|------------------|------------------------------------------------|
| `NOTEY_HOST`     | `0.0.0.0`        | Bind address                                   |
| `NOTEY_PORT`     | `8080`           | Port to listen on                              |
| `NOTEY_STORE`    | `./note-store`   | Notes storage directory (Docker uses `/data`)  |
| `NOTEY_FRONTEND` | `./frontend`     | Static frontend directory                      |

---

# Deployment

notey stores notes on the **local filesystem**, so every strategy below just needs a
durable place for `NOTEY_STORE` and a way to reach the port. Pick one:

| Strategy            | Persists | Inbound port | Best for                         |
|---------------------|:--------:|:------------:|----------------------------------|
| Node                | ✅        | yes          | local dev / quick try            |
| PM2                 | ✅        | yes          | long-lived VPS / bare-metal      |
| Docker + Compose    | ✅ volume | yes          | any host with Docker             |
| Cloudflare Tunnel   | ✅        | **no**       | public URL, no port-forwarding   |
| ngrok               | ✅        | **no**       | quick public demo                |
| Fly.io / Render     | ✅ volume | platform TLS | managed container hosting        |
| Railway             | ✅ volume | platform TLS | managed (uses the Dockerfile)    |
| Vercel / Workers    | ❌        | —            | not supported as-is (see note)   |

## 1 · Node (bare)

```bash
npm start                       # or: ./scripts/setup.sh node
NOTEY_PORT=9000 npm start       # override config via env
```

## 2 · PM2 (VPS / bare-metal)

```bash
npm install -g pm2
pm2 start ecosystem.config.cjs   # or: ./scripts/setup.sh pm2
pm2 save && pm2 startup          # survive reboots
pm2 logs notey
```

Set an absolute `NOTEY_STORE` (e.g. `/var/lib/notey`) in `ecosystem.config.cjs` for
production. Run a **single instance** — see [Scaling](#persistence--scaling).

## 3 · Docker

```bash
docker compose up -d --build     # or: ./scripts/setup.sh docker
# → http://localhost:8080 ; notes persist in the `notey-data` volume
docker compose logs -f
docker compose down              # stop (volume/notes preserved)
```

The image is `node:20-alpine`, runs as a non-root user, has a `HEALTHCHECK`, and needs
no install step (zero deps).

## 4 · Public URL with Cloudflare Tunnel (recommended for exposing)

No open ports, no public IP, **free TLS with nothing to register** — once your domain is
on Cloudflare it gets Universal SSL automatically and the tunnel makes an **outbound**
connection. If your domain is *not* on Cloudflare, use [Let's Encrypt](#9--free-https-with-lets-encrypt-no-cloudflare) instead.

**Throwaway URL** (no account needed):

```bash
./scripts/setup.sh tunnel        # starts notey if needed + prints a *.trycloudflare.com URL
# equivalently: cloudflared tunnel --url http://localhost:8080
```

**Persistent hostname** (your domain):

```bash
cloudflared tunnel login
cloudflared tunnel create notey
cloudflared tunnel route dns notey notey.example.com
cp deploy/cloudflared/config.example.yml deploy/cloudflared/config.yml   # edit id + hostname
cloudflared tunnel --config deploy/cloudflared/config.yml run
```

**With Docker** — run the bundled `cloudflared` sidecar (point the tunnel's public
hostname at `http://notey:8080` in the Zero Trust dashboard):

```bash
CLOUDFLARE_TUNNEL_TOKEN=xxxxx docker compose --profile tunnel up -d
```

## 5 · ngrok

```bash
ngrok http 8080                  # while notey runs locally
```

## 6 · Fly.io

```bash
fly launch --no-deploy           # creates the app from fly.toml
fly volumes create notey_data --size 1
fly deploy
```

## 7 · Render

Dashboard → **New → Blueprint** → select this repo. `render.yaml` provisions a Docker
web service with a 1 GB disk mounted at `/data`.

## 8 · Railway

New project → **Deploy from repo**. Railway builds the `Dockerfile` automatically. Add a
**Volume** mounted at `/data` and set `NOTEY_STORE=/data`.

## 9 · Free HTTPS with Let's Encrypt (no Cloudflare)

Use this when your domain is **not** on Cloudflare and you want your own free,
auto-renewing certificate on your public IP. Requires ports **80 and 443 open** (unlike
the tunnel) and an A record: `notey.space → your.server.ip`.

```bash
# 1. Run notey bound to localhost (nginx will face the internet)
NOTEY_HOST=127.0.0.1 pm2 start ecosystem.config.cjs   # or set it in ecosystem.config.cjs

# 2. Install nginx + certbot
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx

# 3. Add notey's reverse-proxy site
sudo cp deploy/nginx/notey.conf /etc/nginx/sites-available/notey.conf
sudo ln -s /etc/nginx/sites-available/notey.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 4. Register the free SSL certificate (Let's Encrypt) — certbot edits nginx for you
sudo certbot --nginx -d notey.space -d www.notey.space
#   choose "redirect HTTP → HTTPS" when asked

# 5. Confirm auto-renewal is armed (certbot installs a systemd timer / cron)
sudo certbot renew --dry-run
```

Now `https://notey.space` serves notey with a valid certificate that renews itself every
~60 days. Because the proxy forwards `X-Forwarded-Proto` and `X-Forwarded-For`, notey's
rate limits still see real client IPs. Config template: `deploy/nginx/notey.conf`.

## 10 · Behind an existing reverse proxy (shared server)

If the server already runs a reverse proxy (Caddy, nginx, Traefik) fronting other apps
on 80/443 — common on a shared box — **do not** bind notey to 80. Run it as a container
on the proxy's network and add a virtual host. Example with **Caddy** (its `reverse_proxy`
reaches containers by name):

1. Build + run notey on the proxy's Docker network, no published host port:
   ```bash
   docker build -t notey:latest /opt/notey
   docker run -d --name notey --restart unless-stopped \
     --network <proxy_network> -v notey-data:/data notey:latest
   # find the network:
   #   docker inspect <proxy-container> \
   #     --format '{{range $k,$_ := .NetworkSettings.Networks}}{{$k}} {{end}}'
   ```
2. Add a site to the Caddyfile (back it up first), validate, then graceful reload:
   ```caddyfile
   http://notey.example.com {
       encode zstd gzip
       reverse_proxy notey:8080
   }
   ```
   ```bash
   cp Caddyfile Caddyfile.bak
   docker exec <caddy> caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
   docker exec <caddy> caddy reload   --config /etc/caddy/Caddyfile --adapter caddyfile
   ```

`http://` makes Caddy serve plain HTTP on :80 with **no auto-HTTPS redirect** — pair it
with **Cloudflare proxied DNS + SSL mode "Flexible"** so visitors still get HTTPS while
the origin stays on port 80. (Serving `https://` / Full mode instead makes Caddy fetch a
cert — see §4 and §9.) Always `validate` before `reload` so a typo can't take the proxy —
and its other sites — down.

nginx equivalent: a `server { server_name notey.example.com; location / { proxy_pass
http://127.0.0.1:8080; } }` block, with notey published on `127.0.0.1:8080`.

**Real client IPs:** behind a proxy, forward `X-Forwarded-For` (Caddy does by default;
behind Cloudflare also honour `CF-Connecting-IP` via `trusted_proxies`) so notey's rate
limits see visitors, not the proxy.

## Updating a deployment

```bash
./scripts/redeploy.sh                                  # rebuild + restart the container
NOTEY_PORT_PUBLISH=80 ./scripts/redeploy.sh            # standalone, publish on :80
NOTEY_NETWORK=chatwoot_default ./scripts/redeploy.sh   # behind an existing proxy
```

Pulls latest, rebuilds the image, recreates the `notey` container. Notes persist in the
`notey-data` volume.

## Vercel / serverless — why it's not supported (yet)

Serverless functions have an **ephemeral, read-only filesystem**, so notes written by
`FileNoteRepository` would vanish on the next cold start. The backend is deliberately
built around a `NoteRepository` base class (see `backend/src/domain/note/`), so the
supported path is to add a `KvNoteRepository` (Vercel KV / Cloudflare KV / Redis) and
select it in `backend/src/server.js`. The API, domain logic, and frontend stay unchanged.
PRs welcome.

## Persistence & scaling

- **Persistence** = whatever `NOTEY_STORE` points at. Docker/Fly/Render mount a volume at
  `/data`; on a VPS use a real directory and back it up.
- **Run one instance per store.** Filesystem storage + in-memory rate limiting mean
  multiple PM2 cluster workers or replicas would race on writes and diverge. Scale up
  (bigger box), not out. Cluster/multi-replica is not supported.
- Put TLS in front via the platform (Fly/Render), Cloudflare Tunnel, or an nginx reverse
  proxy:

  ```nginx
  server {
    listen 80;
    server_name notey.example.com;
    location / { proxy_pass http://127.0.0.1:8080; proxy_set_header Host $host; }
  }
  ```

  Run notey with `NOTEY_HOST=127.0.0.1` behind it. Client IPs are read from
  `X-Forwarded-For`, so rate limits stay accurate behind a proxy/tunnel.

## Security

Path handling and storage are the sensitive surfaces; both are defended in layers.

- **Path traversal** — the untrusted URL path is validated by `NotePath`: allowlisted
  segments (`[A-Za-z0-9._-]`, no leading dot), bounded length/depth, rejection of
  `.`/`..`/backslash/null/control chars/bad encoding, plus a final "resolved path must
  stay inside the store root" check. Encoded-slash traversal (`..%2f..%2f`) is rejected.
- **Passwords** — scrypt-hashed with constant-time comparison; unrecoverable. Locked
  notes withhold content until the correct password is supplied.
- **Brute-force guard** — failed unlocks are rate-limited per `ip+note` (8/min → 5-min
  block; a correct password is still refused while blocked).
- **Write throttle** — 120 saves/min per IP. **Storage cap** — new notes refused past
  20,000 (existing notes still editable).
- **Security headers** on every response — CSP (self + the React CDN + Google Fonts),
  `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`,
  `Permissions-Policy`. **XSS** — content renders as React text (auto-escaped).

By design there are **no accounts**: any unlocked note is public and editable by anyone
with the URL. Lock notes that matter.

## Note API

| Method | Route                      | Purpose                                  |
|--------|----------------------------|------------------------------------------|
| GET    | `/api/note/<path>`         | Read note (locked notes withhold content)|
| PUT    | `/api/note/<path>`         | Save `{content, password?}`              |
| POST   | `/api/note-unlock/<path>`  | `{password}` → returns content if correct|
| POST   | `/api/note-lock/<path>`    | `{password, current?}` set/change/clear  |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Keep it zero-dependency; follow the coding rules
in `.devlens/rules.md`; document changes under `docs/`.

## License

[MIT](LICENSE).
