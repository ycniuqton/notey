import { NoteRecord } from "./NoteRecord.js";
import { Limit, Ttl } from "../constants.js";
import { UnauthorizedError, PayloadTooLargeError, StorageLimitError } from "../errors/AppError.js";

// The only note API the HTTP layer talks to (Rule 14). Orchestrates the repository
// and password policy; enforces locking and size rules. Depends on abstractions only.
export class NoteManager {
  constructor(repository, passwordPolicy) {
    this.repository = repository;
    this.passwordPolicy = passwordPolicy;
  }

  async read(notePath) {
    const record = await this.#findLive(notePath);
    if (record === null) return { exists: false, locked: false, content: "" };
    if (record.isLocked) return { exists: true, locked: true, expiresAt: record.expiresAt };
    return { exists: true, locked: false, content: record.content, expiresAt: record.expiresAt };
  }

  async unlock(notePath, password) {
    const record = await this.#findLive(notePath);
    if (record === null) return { exists: false, locked: false, content: "" };
    if (!record.isLocked) return { exists: true, locked: false, content: record.content, expiresAt: record.expiresAt };
    if (!this.passwordPolicy.verify(password ?? "", record.passwordHash)) throw new UnauthorizedError();
    return { exists: true, locked: true, content: record.content, expiresAt: record.expiresAt };
  }

  async save(notePath, content, password, ttl) {
    this.#assertSize(content);
    const existing = await this.#findLive(notePath);
    if (existing === null) await this.#assertStoreHasRoom();
    this.#assertMayEdit(existing, password);
    const record = this.#nextRecord(existing, content, this.#expiresFrom(ttl, existing));
    await this.repository.save(notePath, record);
    return { exists: true, locked: record.isLocked, content: record.content, expiresAt: record.expiresAt };
  }

  async setPassword(notePath, password, current) {
    const existing = (await this.#findLive(notePath)) ?? new NoteRecord({});
    this.#assertMayEdit(existing, current);
    const record = this.#nextRecord(existing, existing.content, existing.expiresAt);
    record.passwordHash = this.#hashOrClear(password);
    await this.repository.save(notePath, record);
    return { exists: true, locked: record.isLocked, expiresAt: record.expiresAt };
  }

  // Load a note, treating an expired one as absent and deleting it on the way out.
  async #findLive(notePath) {
    const record = await this.repository.find(notePath);
    if (record === null) return null;
    if (!record.isExpired) return record;
    await this.repository.remove(notePath);
    return null;
  }

  // Resolve the next expiry: an unset ttl keeps the current one; a token recomputes it.
  #expiresFrom(ttl, existing) {
    if (ttl === undefined || ttl === null) return existing ? existing.expiresAt : null;
    const ms = Ttl.durationMs(ttl);
    return ms === null ? null : new Date(Date.now() + ms).toISOString();
  }

  #assertMayEdit(record, password) {
    if (record && record.isLocked && !this.passwordPolicy.verify(password ?? "", record.passwordHash)) {
      throw new UnauthorizedError();
    }
  }

  #assertSize(content) {
    if (Buffer.byteLength(String(content ?? ""), "utf8") > Limit.MAX_CONTENT_BYTES) {
      throw new PayloadTooLargeError();
    }
  }

  async #assertStoreHasRoom() {
    if ((await this.repository.count(Limit.MAX_NOTES)) >= Limit.MAX_NOTES) {
      throw new StorageLimitError();
    }
  }

  #nextRecord(existing, content, expiresAt) {
    const now = new Date().toISOString();
    return new NoteRecord({
      content: String(content ?? ""),
      passwordHash: existing ? existing.passwordHash : null,
      createdAt: existing && existing.createdAt ? existing.createdAt : now,
      updatedAt: now,
      expiresAt: expiresAt ?? null,
    });
  }

  #hashOrClear(password) {
    const value = String(password ?? "");
    return value.length === 0 ? null : this.passwordPolicy.hash(value);
  }
}
