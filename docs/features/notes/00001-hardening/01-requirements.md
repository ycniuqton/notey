# Notes — Requirements (00001-hardening)

Incremental over 00000-init. Only changes are listed; everything in 00000-init
(URL-path notes, file storage, autosave, markdown, theme, path-traversal defense,
password lock) remains unchanged.

## Added — security hardening
- SR5: Brute-force protection. Failed unlock attempts are rate-limited per
  `client-ip + note`. After 8 failures/min the note unlock is blocked for 5 min —
  even a correct password is rejected while blocked (not bypassable).
- SR6: Write flooding protection. Saves are rate-limited per client IP
  (120/min, 1-min block) to blunt autosave abuse / disk hammering.
- SR7: Security response headers on every response — Content-Security-Policy
  (allows only self + the React CDN + Google Fonts), X-Content-Type-Options,
  X-Frame-Options: DENY, Referrer-Policy, Permissions-Policy.
- SR8: Storage abuse cap. Creating a new note is refused (507) once the store holds
  `MAX_NOTES` (20,000) notes. Overwrites of existing notes are unaffected.
- Client IP is taken from `X-Forwarded-For` (first hop) when present, else the socket
  address — so limits work correctly behind the documented reverse proxy.

## Added — responsiveness
- NFR5: Usable on phones/tablets. Below a 720px viewport: the header and footer wrap,
  the markdown preview stacks **below** the editor instead of splitting side-by-side,
  editor padding shrinks, and popovers/cards cap to the viewport width. No horizontal
  page scroll.

## Unchanged
API surface, storage format, note-path validation, and the zero-dependency /
single-process (`0.0.0.0:PORT`) runtime are all as specified in 00000-init.

## Still out of scope
TLS termination (reverse proxy), user accounts/ownership, distributed rate-limit
state (limits are per-process, in-memory), note listing/search.
