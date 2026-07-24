# Notes — Plan (00000-init)

State legend: [ ] todo · [~] in progress · [x] done

## Backend — domain
- [x] 1. AppConfig + domain constants/enums (HttpStatus, HttpMethod, ContentType, ApiRoute, limits)
- [x] 2. AppError base + Validation/NotFound/Unauthorized subclasses
- [x] 3. NotePath value object — decode, validate, ban traversal, resolve-inside-root
- [x] 4. NoteRecord entity + PasswordPolicy (scrypt hash/verify)
- [x] 5. NoteRepository base class + FileNoteRepository (JSON per note)
- [x] 6. NoteManager service (read / unlock / save / setPassword)

## Backend — http
- [x] 7. RequestContext (parse method/path, read JSON body, send helpers)
- [x] 8. Router dispatch table + HttpServer (bind 0.0.0.0:PORT)
- [x] 9. NoteController (GET/PUT/unlock/lock) + StaticController (files + SPA fallback)
- [x] 10. server.js bootstrap wiring

## Frontend
- [x] 11. index.html shell (fonts, React CDN, root, app.js) + styles.css (design tokens)
- [x] 12. app.js — NoteApp: URL->slug, load/save API client, autosave debounce
- [x] 13. app.js — port design UI: header, markdown md() renderer, preview, theme, counts
- [x] 14. app.js — lock panel: set/clear password, password gate for locked notes

## Verify
- [x] 15. Start server, test: create/save/read, path-traversal rejection, lock/unlock, SPA fallback
      Note: verified via curl + a NotePath adversarial-input harness (temp file, removed after).
- [x] 16. README with run + public-IP (incl. nginx reverse-proxy) instructions
