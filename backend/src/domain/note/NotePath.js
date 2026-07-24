import path from "node:path";
import { Limit } from "../constants.js";
import { ValidationError } from "../errors/AppError.js";

// Value object for an untrusted URL path. Guarantees a safe, in-root note location.
// Construct only via fromRaw(): it decodes, validates and bans every traversal vector.
export class NotePath {
  static #SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$/;
  static #CONTROL = new RegExp("[\\x00-\\x1f\\x7f]");
  static #FILE_SUFFIX = ".json";

  constructor(segments) {
    this.segments = segments;
    this.slug = segments.join("/");
  }

  static fromRaw(raw) {
    const decoded = NotePath.#decode(raw);
    NotePath.#assertNoIllegalChars(decoded);
    const segments = NotePath.#toSegments(decoded);
    NotePath.#assertBounds(segments);
    return new NotePath(segments);
  }

  // Absolute file path for this note, proven to stay inside the store root.
  toFile(storeRoot) {
    const root = path.resolve(storeRoot);
    const file = path.resolve(root, ...this.segments) + NotePath.#FILE_SUFFIX;
    const expected = path.join(root, ...this.segments) + NotePath.#FILE_SUFFIX;
    if (file !== expected || !file.startsWith(root + path.sep)) {
      throw new ValidationError("Note path escapes the store root.");
    }
    return file;
  }

  static #decode(raw) {
    try {
      return decodeURIComponent(String(raw ?? ""));
    } catch {
      throw new ValidationError("Malformed URL path encoding.");
    }
  }

  static #assertNoIllegalChars(value) {
    if (value.includes("\\") || NotePath.#CONTROL.test(value)) {
      throw new ValidationError("Path contains illegal characters.");
    }
  }

  static #toSegments(value) {
    return value
      .split("/")
      .filter((part) => part.length > 0)
      .map((part) => NotePath.#validateSegment(part));
  }

  static #validateSegment(part) {
    if (part === "." || part === "..") throw new ValidationError("Path traversal is not allowed.");
    if (!NotePath.#SEGMENT.test(part)) throw new ValidationError(`Invalid path segment: "${part}".`);
    return part;
  }

  static #assertBounds(segments) {
    if (segments.length === 0) throw new ValidationError("Note path is empty.");
    if (segments.length > Limit.MAX_PATH_SEGMENTS) throw new ValidationError("Note path is too deep.");
  }
}
