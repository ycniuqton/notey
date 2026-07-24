# Notes — Design (00000-init)

## Components
```
frontend/                 static SPA (React via CDN, no build)
  index.html              shell: fonts, root, CDN + app.js
  styles.css              design tokens (dark/light) from Notepad Editor.dc.html
  app.js                  NoteApp component (port of the .dc.html logic) + API client

backend/src/
  server.js               bootstrap: build config -> wire domain -> start HttpServer
  config/AppConfig.js      host, port, store dir, frontend dir, limits (no magic values)
  domain/
    constants.js           HttpStatus, HttpMethod, ContentType, ApiRoute, NoteField enums
    errors/AppError.js      base error (statusCode + code); Validation/NotFound/Unauthorized
    note/NotePath.js        VALUE OBJECT — validates + normalizes untrusted URL path
    note/NoteRecord.js      entity: content, passwordHash, timestamps
    note/PasswordPolicy.js  scrypt hash/verify (crypto built-in)
    note/NoteRepository.js  BASE CLASS (abstract storage contract)
    note/FileNoteRepository.js  concrete: JSON file per note under store root
    note/NoteManager.js     SERVICE — the only note API the HTTP layer talks to
  http/
    HttpServer.js           wraps node:http, binds host:port
    RequestContext.js       parsed method/path/body helpers
    Router.js               dispatch table method+route -> controller method
    NoteController.js       API endpoints (JSON)
    StaticController.js     serves frontend files + SPA fallback
```
Business logic never depends on concrete classes: controllers -> `NoteManager` ->
`NoteRepository` (base) with `FileNoteRepository` injected at bootstrap (Rule 12/14/15).

## Storage layout
`note-store/<segment>/…/<name>.json` — one JSON doc per note:
`{ content, passwordHash|null, createdAt, updatedAt }`. Directory tree mirrors the URL.

## Path validation flow (SECURITY-CRITICAL)
```
Untrusted URL path (e.g. "/usera/file1", "/../../etc/passwd", "%2e%2e/x")
└─ NotePath.fromRaw(raw)
   └─ decodeURIComponent, guarded          malformed escape → ValidationError
   └─ reject null byte / backslash / ctrl   present         → ValidationError
   └─ split on "/", drop empty segments
   └─ each segment tested:
      ├─ equals "." or ".."                 → ValidationError   (traversal)
      ├─ fails /^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$/ → ValidationError
      └─ ok                                 → keep
   └─ segment count > MAX_SEGMENTS          → ValidationError
   └─ toFile(root): path.join(root, ...segs) + ".json"
      └─ path.resolve(file) NOT inside resolve(root) → ValidationError (defense in depth)
      └─ inside                             → safe absolute path
```

## Read a note
```
GET /api/note/<path>
└─ NotePath.fromRaw(path)                    invalid → 400
└─ NoteManager.read(notePath)
   └─ repo.read → not found                  → 200 {exists:false, content:""}
   └─ found, passwordHash == null            → 200 {exists:true, locked:false, content}
   └─ found, passwordHash != null            → 200 {exists:true, locked:true}  (NO content, SR4)
```
---
## Unlock a locked note
```
POST /api/note/<path>/unlock  body {password}
└─ NoteManager.unlock(notePath, password)
   └─ record.passwordHash == null            → 200 {locked:false, content}
   └─ PasswordPolicy.verify(pw, hash) false  → 401 Unauthorized  (no content, SR4)
   └─ verify true                            → 200 {locked:true, content}
```
---
## Save a note (autosave)
```
PUT /api/note/<path>  body {content, password?}
└─ NoteManager.save(notePath, content, password?)
   └─ existing record locked
      ├─ password missing / wrong            → 401 Unauthorized  (edit blocked)
      └─ password ok                          → write content, keep hash → 200
   └─ not locked (new or open)               → write content (create dirs) → 200 {exists:true}
```
---
## Lock / change / clear password
```
POST /api/note/<path>/lock  body {password, current?}
└─ NoteManager.setPassword(notePath, password, current?)
   └─ record already locked & current wrong  → 401 Unauthorized
   └─ password empty/null                    → clear hash (unlock note) → 200 {locked:false}
   └─ password set                           → store scrypt hash        → 200 {locked:true}
```
---
## SPA + static serving
```
GET <any non-/api path>
└─ StaticController
   └─ path matches a real frontend file (index.html, app.js, styles.css) → serve it
   └─ otherwise                                                          → serve index.html (SPA fallback)
```

## Unchanged
Nothing yet — this is the initial version.
