// Domain constants and enums. No magic strings/numbers live outside this module.

export class HttpStatus {
  static OK = 200;
  static BAD_REQUEST = 400;
  static UNAUTHORIZED = 401;
  static NOT_FOUND = 404;
  static METHOD_NOT_ALLOWED = 405;
  static PAYLOAD_TOO_LARGE = 413;
  static TOO_MANY_REQUESTS = 429;
  static INTERNAL = 500;
  static INSUFFICIENT_STORAGE = 507;
}

export class HttpMethod {
  static GET = "GET";
  static PUT = "PUT";
  static POST = "POST";
}

export class ContentType {
  static JSON = "application/json; charset=utf-8";
  static HTML = "text/html; charset=utf-8";
  static JS = "text/javascript; charset=utf-8";
  static CSS = "text/css; charset=utf-8";
  static TEXT = "text/plain; charset=utf-8";
}

export class ApiRoute {
  static API_PREFIX = "/api/";
  static NOTE = "/api/note/";
  static UNLOCK = "/api/note-unlock/";
  static LOCK = "/api/note-lock/";
}

export class NoteField {
  static CONTENT = "content";
  static PASSWORD = "password";
  static CURRENT = "current";
  static PASSWORD_HASH = "passwordHash";
  static CREATED_AT = "createdAt";
  static UPDATED_AT = "updatedAt";
  static TTL = "ttl";
  static EXPIRES_AT = "expiresAt";
}

// Note lifetime tokens the client may request. A token maps to a duration in ms;
// FOREVER (or an unknown token) means no expiry. Absent ttl leaves expiry unchanged.
export class Ttl {
  static FOREVER = "forever";
  static #DURATIONS = {
    "1h": 3_600_000,
    "1d": 86_400_000,
    "7d": 604_800_000,
    "30d": 2_592_000_000,
  };

  static isKnown(token) {
    return token === Ttl.FOREVER || Object.prototype.hasOwnProperty.call(Ttl.#DURATIONS, token);
  }

  static durationMs(token) {
    return Object.prototype.hasOwnProperty.call(Ttl.#DURATIONS, token) ? Ttl.#DURATIONS[token] : null;
  }
}

export class ErrorCode {
  static VALIDATION = "validation_error";
  static NOT_FOUND = "not_found";
  static UNAUTHORIZED = "unauthorized";
  static PAYLOAD_TOO_LARGE = "payload_too_large";
  static RATE_LIMITED = "rate_limited";
  static STORAGE_FULL = "storage_full";
  static INTERNAL = "internal_error";
}

export class Limit {
  static MAX_PATH_SEGMENTS = 8;
  static MAX_SEGMENT_LENGTH = 63;
  static MAX_CONTENT_BYTES = 1_000_000; // 1 MB per note
  static MAX_BODY_BYTES = 1_200_000;    // request body ceiling
  static MAX_NOTES = 20_000;            // total notes on disk (abuse cap)
}

// Rate-limit policies. maxHits within windowMs; exceeding blocks for blockMs.
export class RatePolicy {
  static UNLOCK = { maxHits: 8, windowMs: 60_000, blockMs: 300_000 };   // password guessing
  static WRITE = { maxHits: 120, windowMs: 60_000, blockMs: 60_000 };   // save flooding
}

// Response headers applied to every response (defense-in-depth hardening).
export class SecurityHeader {
  static CSP =
    "default-src 'self'; " +
    "script-src 'self' https://unpkg.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src https://fonts.gstatic.com; " +
    "img-src 'self' data:; connect-src 'self'; base-uri 'self'; " +
    "form-action 'self'; frame-ancestors 'none'";
  static VALUES = {
    "Content-Security-Policy": SecurityHeader.CSP,
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
  };
}
