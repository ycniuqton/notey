# Notes — Design (00002-lifecycle)

Incremental over 00001. Unchanged: NotePath validation, PasswordPolicy, RateLimiter,
StaticController, Router, HttpServer, the autosave/preview/lock UI.

## What changed
```
constants.js         + NoteField.TTL / EXPIRES_AT ; + Ttl domain (token → duration ms)
NoteRecord.js        + expiresAt field ; + isExpired getter ; expiresAt in toJSON
NoteRepository.js    + remove(notePath) contract
FileNoteRepository   + remove() → fs.unlink, ENOENT tolerated
NoteManager.js       reads/saves go through #findLive (lazy expiry) ; save() takes ttl ;
                     #expiresFrom(ttl, existing) resolves the next expiry
NoteController.js    #save forwards body.ttl to manager.save
frontend/app.js      New-note button + newNote() ; TTL <select> + chooseTtl() ;
                     save() sends state.ttl ; load()/save() track state.expiresAt
```

## Ttl domain (single source of truth for tokens)
```
Ttl.FOREVER = "forever"
Ttl.durationMs(token) → ms for 1h/1d/7d/30d, else null (null = forever/unknown)
frontend TTL_OPTIONS mirrors these tokens (must stay in sync)
```

## Save with a lifetime (trigger: PUT /api/note/<slug> with ttl)
```
PUT /api/note/<slug> { content, password?, ttl? }
└─ NoteController#save → writeLimiter allow+record
   └─ NoteManager.save(path, content, password, ttl)
      └─ assertSize(content)
      └─ existing = #findLive(path)                 [lazy expiry, see below]
      │  └─ existing === null → assertStoreHasRoom()
      └─ assertMayEdit(existing, password)          → locked+wrong → 401 Unauthorized
      └─ expiresAt = #expiresFrom(ttl, existing)
      │  ├─ ttl absent (undefined/null) → keep existing.expiresAt        (R8)
      │  ├─ ttl = "forever"/unknown     → null                          (R7)
      │  └─ ttl = "1h".."30d"           → now + durationMs → ISO        (R4)
      └─ repository.save(record{...content, expiresAt})
      └─ 200 { slug, exists, locked, content, expiresAt }
```

## Lazy expiry on any access (read / unlock / save-lookup)
```
NoteManager.#findLive(path)
└─ record = repository.find(path)
   ├─ null            → return null                         (never existed)
   ├─ !record.isExpired → return record                     (still alive)
   └─ record.isExpired  → repository.remove(path) ; return null
                          → caller sees it as a brand-new note (R6)
isExpired = expiresAt !== null && Date.parse(expiresAt) <= now
```
No cron/sweeper: expiry is realized the next time the note is touched. A note that is
never visited again simply sits on disk until its next read — acceptable for this store
(abuse cap still bounds total files). A background sweeper is a future extension point.

## Client lifetime picker (trigger: user action)
```
state: ttl (null = untouched this session) , expiresAt (from server, display only)

new-note button click
└─ newNote() → flush pending save if dirty [async] → location.assign("/" + randomSlug())

ttl <select> change → chooseTtl(value)
└─ setState ttl=value → clearTimeout(debounce) → save() immediately        (R5)
   └─ save() sends state.ttl → server recomputes expiry → state.expiresAt updated

ordinary typing → onType → debounced save() → sends state.ttl
   └─ ttl still null on a note the user never re-scoped → server preserves expiry (R8)

select displayed value:
├─ ttl set this session        → that token
├─ ttl null & expiresAt present → synthetic "Deletes in <rel>" option (not clobbering) (R9)
└─ otherwise                    → "forever"
```

## Trust / safety notes
- Client sends a token, never a timestamp → cannot forge arbitrary expiry (R7).
- ttl travels the same PUT path already covered by WRITE rate limits + size caps.
- remove() tolerates ENOENT so concurrent expiry of the same note is race-safe.
- A locked note keeps its expiry through setPassword (existing.expiresAt carried).
