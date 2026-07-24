# Notes — Design (00001-hardening)

Incremental over 00000-init. Component structure is unchanged except for the additions
below; the note domain, storage, and controllers keep their 00000-init behavior.

## New / changed components
```
backend/src/
  domain/constants.js        + HttpStatus 429/507, ErrorCode rate_limited/storage_full,
                               Limit.MAX_NOTES, RatePolicy (UNLOCK/WRITE), SecurityHeader
  domain/errors/AppError.js  + TooManyRequestsError (429), StorageLimitError (507)
  domain/security/RateLimiter.js  NEW — reusable fixed-window limiter (one class, two
                               configured instances via RatePolicy; Rule 15)
  domain/note/NoteRepository.js   + count(cap) contract
  domain/note/FileNoteRepository.js + recursive count(cap), stops early at cap
  domain/note/NoteManager.js      + reject new-note create when store is full (SR8)
  http/RequestContext.js     + clientIp (X-Forwarded-For | socket); security headers
                               attached to EVERY response in #send
  http/NoteController.js     + unlockLimiter / writeLimiter injected; guards on
                               unlock (count failures) and save (throttle writes)
  server.js                  + build two RateLimiter instances, inject into controller
frontend/
  app.js                     + narrow-viewport state + resize listener; header/footer
                               wrap, preview stacks vertically, popover/card width caps
  styles.css                 + overflow-x:hidden guard
```

## Unlock brute-force guard (SR5)
```
POST /api/note-unlock/<path>
└─ key = clientIp + ":" + slug
└─ unlockLimiter.assertAllowed(key)     blocked → 429 (even if password is correct)
└─ NoteManager.unlock(path, password)
   ├─ wrong password → UnauthorizedError → limiter.record(key)  → (9th/min sets 5-min block) → 401
   └─ correct        → limiter.reset(key)                        → 200 + content
```
---
## Write throttle (SR6)
```
PUT /api/note/<path>
└─ writeLimiter.assertAllowed(clientIp)   blocked → 429
└─ writeLimiter.record(clientIp)          >120/min → sets 1-min block → 429
└─ NoteManager.save(...)                  (00000-init behavior)
```
---
## Storage cap (SR8)
```
NoteManager.save → existing == null (new note)
└─ repository.count(MAX_NOTES) >= MAX_NOTES → StorageLimitError → 507
└─ else → write as normal
(existing-note overwrite skips the count check entirely)
```
---
## Security headers (SR7)
```
Every response → RequestContext.#send
└─ writeHead(status, { Content-Type, ...SecurityHeader.VALUES })
   CSP: default-src 'self'; script-src 'self' unpkg.com; style-src 'self' 'unsafe-inline'
        fonts.googleapis.com; font-src fonts.gstatic.com; img-src 'self' data:;
        connect-src 'self'; frame-ancestors 'none'
   + X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy
```
---
## Responsive layout (NFR5)
```
window resize / load
└─ NoteApp.state.narrow = innerWidth < 720
   ├─ narrow  → header/footer flexWrap; main flexDirection column (preview below,
   │            border-top not border-left); reduced padding; popover/card width
   │            = min(px, calc(100vw - margin))
   └─ wide    → original side-by-side design
```

## Unchanged
Path validation (`NotePath`), storage format, static serving / SPA fallback, and the
GET/PUT/unlock/lock API contracts are exactly as in 00000-init.
