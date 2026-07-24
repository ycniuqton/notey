# Contributing to notey

Thanks for your interest! notey is intentionally small and dependency-free.

## Ground rules
- **Zero runtime dependencies.** The backend must start with only Node ≥ 18. Don't add
  packages to `dependencies` — reach for Node built-ins first. Dev-only tooling goes in
  `devDependencies`.
- **Follow the coding rules** in [`.devlens/rules.md`](.devlens/rules.md): class-based
  domain design, a Manager the HTTP layer talks to, base classes for extensible domains,
  no magic strings, small functions.
- **Document as you go.** Features live under `docs/features/<name>/`, systems under
  `docs/systems/<name>/`. Read the active version's `03-plan.md` before coding and keep
  its checklist current.

## Local development
```bash
git clone <your-fork>
cd notey
cp .env.example .env
npm run dev            # node --watch backend/src/server.js
# open http://localhost:8080
```
No `npm install` is required to run the app (zero deps); `npm install` only pulls the
dev tooling.

## Before opening a PR
- `node --check` passes on changed files (CI runs this + a smoke test).
- Manually verify the affected flow (create/save/read, lock/unlock, path validation).
- Update the relevant docs under `docs/` and note behavior changes in the PR.

## Reporting security issues
Please open a private report rather than a public issue for anything exploitable
(path handling, auth/lock bypass, resource exhaustion).
