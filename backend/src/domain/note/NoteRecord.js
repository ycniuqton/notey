// Entity: the persisted shape of a single note. passwordHash null => note is open.
// expiresAt null => the note lives forever; otherwise an ISO instant to expire at.
export class NoteRecord {
  constructor({ content = "", passwordHash = null, createdAt = null, updatedAt = null, expiresAt = null } = {}) {
    this.content = content;
    this.passwordHash = passwordHash;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.expiresAt = expiresAt;
  }

  get isLocked() {
    return this.passwordHash !== null;
  }

  get isExpired() {
    return this.expiresAt !== null && Date.parse(this.expiresAt) <= Date.now();
  }

  toJSON() {
    return {
      content: this.content,
      passwordHash: this.passwordHash,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      expiresAt: this.expiresAt,
    };
  }
}
