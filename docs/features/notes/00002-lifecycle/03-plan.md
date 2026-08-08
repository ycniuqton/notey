# Notes — Plan (00002-lifecycle)

State legend: [ ] todo · [~] in progress · [x] done

## Backend — TTL domain + expiry
- [x] 1. constants.js: NoteField.TTL/EXPIRES_AT + Ttl class (tokens → duration ms)
- [x] 2. NoteRecord: expiresAt field, isExpired getter, expiresAt in toJSON
- [x] 3. NoteRepository.remove() contract + FileNoteRepository.remove() (ENOENT-safe)
- [x] 4. NoteManager: #findLive lazy-expiry; save(ttl); #expiresFrom; setPassword keeps expiry
- [x] 5. NoteController#save forwards body.ttl; expiresAt returned in all note views

## Frontend — new note + lifetime picker
- [x] 6. NoteApi.save sends ttl (only when provided)
- [x] 7. New-note button + newNote() (flush pending edit, navigate to random slug)
- [x] 8. TTL <select> + chooseTtl() (immediate save); state ttl/expiresAt tracked
- [x] 9. Select shows "Deletes in <rel>" when note has an expiry the user didn't just set

## Verify
- [x] 10. node --check all changed files
- [x] 11. Live API: 1d sets expiresAt; forever clears; omitted ttl preserves expiry
- [x] 12. Live API: planted past-expiry note reads as absent AND is unlinked from disk
- [ ] 13. Browser smoke of New-note button + dropdown (pending — needs deploy/manual)
