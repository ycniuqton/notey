import { NoteRecord } from "./NoteRecord.js";
import { Limit } from "../constants.js";
import { UnauthorizedError, PayloadTooLargeError, StorageLimitError } from "../errors/AppError.js";

// The only note API the HTTP layer talks to (Rule 14). Orchestrates the repository
// and password policy; enforces locking and size rules. Depends on abstractions only.
export class NoteManager {
  constructor(repository, passwordPolicy) {
    this.repository = repository;
    this.passwordPolicy = passwordPolicy;
  }

  async read(notePath) {
    const record = await this.repository.find(notePath);
    if (record === null) return { exists: false, locked: false, content: "" };
    if (record.isLocked) return { exists: true, locked: true };
    return { exists: true, locked: false, content: record.content };
  }

  async unlock(notePath, password) {
    const record = await this.repository.find(notePath);
    if (record === null) return { exists: false, locked: false, content: "" };
    if (!record.isLocked) return { exists: true, locked: false, content: record.content };
    if (!this.passwordPolicy.verify(password ?? "", record.passwordHash)) throw new UnauthorizedError();
    return { exists: true, locked: true, content: record.content };
  }

  async save(notePath, content, password) {
    this.#assertSize(content);
    const existing = await this.repository.find(notePath);
    if (existing === null) await this.#assertStoreHasRoom();
    this.#assertMayEdit(existing, password);
    const record = this.#nextRecord(existing, content);
    await this.repository.save(notePath, record);
    return { exists: true, locked: record.isLocked, content: record.content };
  }

  async setPassword(notePath, password, current) {
    const existing = (await this.repository.find(notePath)) ?? new NoteRecord({});
    this.#assertMayEdit(existing, current);
    const record = this.#nextRecord(existing, existing.content);
    record.passwordHash = this.#hashOrClear(password);
    await this.repository.save(notePath, record);
    return { exists: true, locked: record.isLocked };
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

  #nextRecord(existing, content) {
    const now = new Date().toISOString();
    return new NoteRecord({
      content: String(content ?? ""),
      passwordHash: existing ? existing.passwordHash : null,
      createdAt: existing && existing.createdAt ? existing.createdAt : now,
      updatedAt: now,
    });
  }

  #hashOrClear(password) {
    const value = String(password ?? "");
    return value.length === 0 ? null : this.passwordPolicy.hash(value);
  }
}
