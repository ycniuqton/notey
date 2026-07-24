# Notes — Plan (00001-hardening)

State legend: [ ] todo · [~] in progress · [x] done
Incremental over 00000-init (all its steps remain [x]).

## Security
- [x] 1. Constants: HttpStatus 429/507, ErrorCode, Limit.MAX_NOTES, RatePolicy, SecurityHeader
- [x] 2. Errors: TooManyRequestsError (429), StorageLimitError (507)
- [x] 3. RateLimiter domain class (fixed-window, configurable per policy)
- [x] 4. NoteRepository.count(cap) + FileNoteRepository recursive early-stop count
- [x] 5. NoteManager: refuse new-note create when store full (SR8)
- [x] 6. RequestContext: clientIp + security headers on every response (SR7)
- [x] 7. NoteController: inject unlock/write limiters; guard unlock (SR5) + save (SR6)
- [x] 8. server.js: build + inject two RateLimiter instances

## Responsiveness
- [x] 9. app.js: narrow state + resize listener
- [x] 10. app.js: header/footer wrap, preview stacks vertically, editor padding shrink
- [x] 11. app.js/styles.css: popover/card width caps + overflow-x guard

## Verify
- [x] 12. Security headers present on all responses (curl -D -)
- [x] 13. Unlock: 8 wrong = 401, 9th = 429; correct pw while blocked = 429 (not bypassable)
- [x] 14. Normal save still 200; static assets carry headers
- [x] 15. Restart clean on 0.0.0.0:8080; existing note (quinh) intact
      Note: responsive layout verified by code review + logic; not opened in a headless
      browser here (none available). A real browser session did create/lock a note live.
