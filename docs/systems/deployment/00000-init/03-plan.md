# Deployment — Plan (00000-init)

State legend: [ ] todo · [~] in progress · [x] done

## Open-source hygiene
- [x] 1. MIT LICENSE
- [x] 2. .gitignore (node_modules, note-store contents, .env, logs)
- [x] 3. .env.example (all NOTEY_* + CLOUDFLARE_TUNNEL_TOKEN)
- [x] 4. Root package.json: manifest + scripts; devlens → devDependencies
- [x] 5. CONTRIBUTING.md

## Containers & process managers
- [x] 6. Dockerfile (node:20-alpine, non-root, healthcheck, zero deps)
- [x] 7. .dockerignore
- [x] 8. docker-compose.yml + optional cloudflared tunnel profile
- [x] 9. ecosystem.config.cjs (PM2, single fork instance)

## Tunnels & PaaS
- [x] 10. deploy/cloudflared/config.example.yml
- [x] 11. fly.toml
- [x] 12. render.yaml
- [x] 12b. deploy/nginx/notey.conf + Let's Encrypt/certbot free-SSL path (non-Cloudflare)

## Automation
- [x] 13. scripts/setup.sh (auto-detect + node|pm2|docker|tunnel dispatch)
- [x] 14. .github/workflows/ci.yml (node --check + smoke test)

## Docs
- [x] 15. Rewrite README.md (open-source + deployment focused, per-platform steps)

## Post-deploy improvements (from the first live deploy)
- [x] 19. Fix ecosystem.config.cjs so shell env (NOTEY_PORT/HOST/STORE) wins over defaults
- [x] 20. scripts/redeploy.sh (pull + rebuild + recreate; NETWORK/PORT_PUBLISH options)
- [x] 21. README §10 "behind an existing reverse proxy" + "Updating a deployment"
- [x] 22. Design doc: field-verified shared-proxy pattern (Caddy + Cloudflare Flexible)

## Verify
- [x] 16. node --check / bash -n on all new scripts; YAML sanity
- [x] 17. setup.sh node mode boots server on an alt port and answers 200
- [x] 18. Live Cloudflare quick-tunnel smoke test (public trycloudflare URL returns app)
      Note: Docker & PM2 not installed in this env → configs validated by syntax only,
      not a live container/daemon run.
