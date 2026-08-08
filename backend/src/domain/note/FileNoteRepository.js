import fs from "node:fs/promises";
import path from "node:path";
import { NoteRepository } from "./NoteRepository.js";
import { NoteRecord } from "./NoteRecord.js";

// File-backed note store: one JSON document per note under the store root.
// The directory tree mirrors the URL path (usera/file1 -> usera/file1.json).
export class FileNoteRepository extends NoteRepository {
  static #NOT_FOUND = "ENOENT";
  static #ENCODING = "utf8";
  static #SUFFIX = ".json";

  constructor(storeRoot) {
    super();
    this.storeRoot = storeRoot;
  }

  async find(notePath) {
    const file = notePath.toFile(this.storeRoot);
    const raw = await this.#readFile(file);
    return raw === null ? null : new NoteRecord(JSON.parse(raw));
  }

  async save(notePath, record) {
    const file = notePath.toFile(this.storeRoot);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(record.toJSON()), FileNoteRepository.#ENCODING);
    return record;
  }

  async remove(notePath) {
    const file = notePath.toFile(this.storeRoot);
    try {
      await fs.unlink(file);
    } catch (err) {
      if (err.code !== FileNoteRepository.#NOT_FOUND) throw err;
    }
  }

  async count(cap) {
    return this.#countDir(this.storeRoot, cap);
  }

  async #countDir(dir, cap) {
    let total = 0;
    const entries = await this.#entries(dir);
    for (const entry of entries) {
      total += await this.#countEntry(dir, entry, cap - total);
      if (total >= cap) return total;
    }
    return total;
  }

  async #countEntry(dir, entry, remaining) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return this.#countDir(full, remaining);
    return entry.name.endsWith(FileNoteRepository.#SUFFIX) ? 1 : 0;
  }

  async #entries(dir) {
    try {
      return await fs.readdir(dir, { withFileTypes: true });
    } catch (err) {
      if (err.code === FileNoteRepository.#NOT_FOUND) return [];
      throw err;
    }
  }

  async #readFile(file) {
    try {
      return await fs.readFile(file, FileNoteRepository.#ENCODING);
    } catch (err) {
      if (err.code === FileNoteRepository.#NOT_FOUND) return null;
      throw err;
    }
  }
}
