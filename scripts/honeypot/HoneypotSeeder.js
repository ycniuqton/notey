import fs from "node:fs/promises";
import path from "node:path";
import { NotePath } from "../../backend/src/domain/note/NotePath.js";
import { PasswordPolicy } from "../../backend/src/domain/note/PasswordPolicy.js";
import { NoteTemplateManager } from "./NoteTemplates.js";

// Produces plausible "old" created/updated instants (2021–2024) so honeypot
// notes read as abandoned data an attacker stumbles onto years later.
export class TimestampFactory {
  static #START = Date.UTC(2021, 0, 1);
  static #END = Date.UTC(2024, 11, 31);
  static #EDIT_WINDOW_MS = 90 * 86_400_000;

  create(rng) {
    const created = rng.int(TimestampFactory.#START, TimestampFactory.#END);
    const updated = Math.min(created + rng.int(0, TimestampFactory.#EDIT_WINDOW_MS), TimestampFactory.#END);
    return { createdAt: new Date(created).toISOString(), updatedAt: new Date(updated).toISOString() };
  }
}

// Assembles one honeypot note: a safe NotePath plus a record whose JSON is
// byte-identical to a real note (same key order; some omit expiresAt like
// pre-lifecycle legacy notes; a fraction are scrypt-locked).
export class HoneypotNoteFactory {
  constructor(rng, lockedRatio) {
    this.rng = rng;
    this.lockedRatio = lockedRatio;
    this.templates = new NoteTemplateManager();
    this.timestamps = new TimestampFactory();
    this.passwords = new PasswordPolicy();
  }

  create(index) {
    const template = this.templates.pick(this.rng);
    const built = template.build(this.rng);
    const notePath = this.#toUniquePath(built.segments, index);
    const locked = template.lockable && this.rng.chance(this.lockedRatio);
    return { notePath, json: this.#serialize(built.content, locked) };
  }

  #toUniquePath(segments, index) {
    const tail = segments.slice();
    tail[tail.length - 1] = `${tail[tail.length - 1]}-${index.toString(36)}`;
    return NotePath.fromRaw(tail.join("/"));
  }

  // Build the record in real-note key order; legacy-style notes drop expiresAt.
  #serialize(content, locked) {
    const times = this.timestamps.create(this.rng);
    const record = {
      content,
      passwordHash: locked ? this.passwords.hash(this.rng.token(10)) : null,
      createdAt: times.createdAt,
      updatedAt: times.updatedAt,
    };
    if (this.rng.chance(0.5)) record.expiresAt = null;
    return JSON.stringify(record);
  }
}

// Append-only record of every path this tool created, stored outside the note
// store so --clean removes exactly what was seeded and nothing a human wrote.
export class SeedManifest {
  constructor(manifestPath) {
    this.manifestPath = manifestPath;
    this.buffer = [];
  }

  add(slug) {
    this.buffer.push(slug);
  }

  async flush() {
    if (this.buffer.length === 0) return;
    await fs.appendFile(this.manifestPath, this.buffer.join("\n") + "\n", "utf8");
    this.buffer = [];
  }

  async readSlugs() {
    try {
      const raw = await fs.readFile(this.manifestPath, "utf8");
      return raw.split("\n").map((s) => s.trim()).filter((s) => s.length > 0);
    } catch (err) {
      if (err.code === "ENOENT") return [];
      throw err;
    }
  }

  async discard() {
    await fs.rm(this.manifestPath, { force: true });
  }
}

// Writes note files, creating each directory once (cached) for speed at scale.
export class FileWriter {
  constructor(storeRoot) {
    this.storeRoot = storeRoot;
    this.dirs = new Set();
  }

  async write(notePath, json) {
    const file = notePath.toFile(this.storeRoot);
    const dir = path.dirname(file);
    if (!this.dirs.has(dir)) {
      await fs.mkdir(dir, { recursive: true });
      this.dirs.add(dir);
    }
    await fs.writeFile(file, json, "utf8");
  }
}

// Orchestrates a seeding run: generate -> write -> record, in bounded-concurrency
// batches so a million notes neither blocks nor exhausts file handles.
export class HoneypotSeeder {
  static #BATCH = 256;

  constructor({ rng, storeRoot, manifest, lockedRatio }) {
    this.factory = new HoneypotNoteFactory(rng, lockedRatio);
    this.writer = new FileWriter(storeRoot);
    this.manifest = manifest;
  }

  async seed(count, onProgress) {
    for (let start = 0; start < count; start += HoneypotSeeder.#BATCH) {
      const end = Math.min(start + HoneypotSeeder.#BATCH, count);
      await this.#writeBatch(start, end);
      await this.manifest.flush();
      if (onProgress) onProgress(end, count);
    }
  }

  async #writeBatch(start, end) {
    const jobs = [];
    for (let i = start; i < end; i++) {
      const note = this.factory.create(i);
      this.manifest.add(note.notePath.slug);
      jobs.push(this.writer.write(note.notePath, note.json));
    }
    await Promise.all(jobs);
  }
}

// Reverses a seeding run: removes every file named in the manifest, then prunes
// the directories that fall empty. Only touches paths this tool recorded.
export class HoneypotCleaner {
  constructor({ storeRoot, manifest }) {
    this.storeRoot = storeRoot;
    this.manifest = manifest;
    this.dirs = new Set();
  }

  async clean() {
    const slugs = await this.manifest.readSlugs();
    let removed = 0;
    for (const slug of slugs) removed += await this.#removeOne(slug);
    await this.#pruneDirs();
    await this.manifest.discard();
    return { removed, listed: slugs.length };
  }

  async #removeOne(slug) {
    const file = NotePath.fromRaw(slug).toFile(this.storeRoot);
    this.dirs.add(path.dirname(file));
    try {
      await fs.unlink(file);
      return 1;
    } catch (err) {
      if (err.code === "ENOENT") return 0;
      throw err;
    }
  }

  // Try deepest directories first; rmdir refuses non-empty dirs, which we ignore.
  async #pruneDirs() {
    const ordered = [...this.dirs].sort((a, b) => b.length - a.length);
    for (const dir of ordered) {
      if (dir === this.storeRoot) continue;
      await fs.rmdir(dir).catch(() => {});
    }
  }
}
