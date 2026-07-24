// Entity: the persisted shape of a single note. passwordHash null => note is open.
export class NoteRecord {
  constructor({ content = "", passwordHash = null, createdAt = null, updatedAt = null } = {}) {
    this.content = content;
    this.passwordHash = passwordHash;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  get isLocked() {
    return this.passwordHash !== null;
  }

  toJSON() {
    return {
      content: this.content,
      passwordHash: this.passwordHash,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
