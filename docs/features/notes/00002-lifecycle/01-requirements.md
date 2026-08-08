# Notes — Requirements (00002-lifecycle)

Builds on 00000-init + 00001-hardening. Only new/changed requirements below;
everything else (path safety, locking, autosave, rate limits, caps) is unchanged.

## New note action
- R1. From any note the user can start a fresh note in one click, without hand-editing
  the URL. It navigates to a new random slug (same scheme as an empty landing).
- R2. A pending edit on the current note is flushed before navigating, so leaving does
  not lose the last keystrokes.

## Note lifetime (TTL)
- R3. Each note may be given a lifetime: Keep forever (default), 1 hour, 1 day,
  1 week, 1 month. Chosen from a dropdown in the header.
- R4. Forever means no expiry. A finite lifetime is measured from the moment of the
  save that carries it (activity slides the expiry forward — it is "delete after
  inactivity", not a fixed wall-clock from creation).
- R5. Choosing a lifetime takes effect immediately, even on an untouched note.
- R6. An expired note behaves exactly as if it never existed (reads as a new note) and
  its file is removed from disk on first access after expiry (lazy delete).
- R7. TTL tokens are validated server-side; an unknown token means forever. The client
  never sends a raw timestamp — only a token — so it cannot forge an arbitrary expiry.
- R8. When the client does NOT send a ttl (e.g. an ordinary autosave), the existing
  expiry is preserved — a normal edit must not silently clear a note's lifetime.
- R9. The dropdown never misrepresents the note: if a note already has an expiry the
  user did not just set this session, it is shown as "Deletes in <time>".
