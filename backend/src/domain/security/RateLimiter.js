import { TooManyRequestsError } from "../errors/AppError.js";

// In-memory fixed-window rate limiter, keyed by an arbitrary string (e.g. ip:slug).
// Configurable per policy (Rule 15) so the same class backs unlock and write guards.
export class RateLimiter {
  constructor({ maxHits, windowMs, blockMs }) {
    this.maxHits = maxHits;
    this.windowMs = windowMs;
    this.blockMs = blockMs;
    this.entries = new Map();
  }

  // Throw if the key is currently blocked. Call before doing the guarded work.
  assertAllowed(key) {
    const entry = this.entries.get(key);
    if (entry && entry.blockedUntil > Date.now()) throw new TooManyRequestsError();
  }

  // Register one hit; block (and throw) once hits exceed maxHits within the window.
  record(key) {
    const now = Date.now();
    const entry = this.#current(key, now);
    entry.hits += 1;
    if (entry.hits > this.maxHits) {
      entry.blockedUntil = now + this.blockMs;
      throw new TooManyRequestsError();
    }
  }

  reset(key) {
    this.entries.delete(key);
  }

  #current(key, now) {
    const entry = this.entries.get(key);
    if (!entry || now - entry.windowStart > this.windowMs) {
      const fresh = { windowStart: now, hits: 0, blockedUntil: 0 };
      this.entries.set(key, fresh);
      return fresh;
    }
    return entry;
  }
}
