# Notes — Requirements (00000-init)

## Summary
A minimalist web notepad where **the URL path is the note**. Visiting any path
(e.g. `notey.space/usera/file1`) opens that note; typing autosaves it to disk.
No accounts. Optional per-note password protection.

## Functional
- FR1: Any URL path maps to one note. Visiting a non-existent path opens a blank
  editor; the first save creates the note on disk.
- FR2: Notes are stored on the local filesystem under a single root folder
  (`note-store/`), mirroring the URL path (`usera/file1` -> `note-store/usera/file1.json`).
- FR3: Editing autosaves (debounced). The header shows a live save status.
- FR4: Markdown preview toggle, light/dark theme toggle, live word/char/line counts,
  and a "copy link" action — all per the provided design.
- FR5: A note can be locked with a password. Reading or editing a locked note
  requires the password. Passwords are hashed server-side (scrypt) and never stored
  in plain text; they cannot be recovered.
- FR6: Root path `/` generates a random slug and redirects, so a fresh visit always
  lands on a real note URL.

## Security (critical)
- SR1: The URL path is untrusted input. Reject path traversal and escape attempts:
  `..`, absolute paths, backslashes, null bytes, control chars, URL-encoded variants.
- SR2: Each path segment must match a strict allowlist (`[A-Za-z0-9._-]`, no leading
  dot), bounded length, bounded depth.
- SR3: Defense in depth — the resolved filesystem path must remain inside the store
  root; otherwise reject.
- SR4: Locked-note content is never returned without a verified password.

## Non-functional
- NFR1: Backend has **zero external dependencies** (Node built-ins only) so it runs
  on a public IP without an npm install step.
- NFR2: Server binds `0.0.0.0:PORT` (default 8080), serves the frontend and the note API.
- NFR3: Frontend is a plain static SPA (React via CDN, no build step); backend serves
  `index.html` as SPA fallback for any non-API path.
- NFR4: Code follows `.devlens/rules.md`: class-based domain design, a Manager the
  HTTP layer talks to, base classes for extensible domains, no magic strings.

## Out of scope (this version)
- Multi-user auth / ownership, note listing/search, edit history, TLS termination
  (handled by an external reverse proxy if needed), real-time collaboration.
