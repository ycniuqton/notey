import fs from "node:fs/promises";
import path from "node:path";
import { Rng } from "./Rng.js";
import { NoteTemplateManager } from "./NoteTemplates.js";
import { PathStrategyManager } from "./PathStrategy.js";

// Produces plausible "old" created/updated instants (2021–2024) so honeypot notes
// read as abandoned data. Derived from the note's own rng → fully reproducible.
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

// Assembles one honeypot note as a pure function of (masterSeed, index): same seed
// ⇒ identical path AND bytes. No crypto/time randomness, so a run can be regenerated
// for cleanup with zero on-disk record of what is fake.
export class HoneypotNoteFactory {
  constructor(masterSeed, w3wRatio) {
    this.masterSeed = masterSeed;
    this.templates = new NoteTemplateManager();
    this.paths = new PathStrategyManager(w3wRatio);
    this.timestamps = new TimestampFactory();
  }

  create(index) {
    const rng = Rng.forNote(this.masterSeed, index);
    const built = this.templates.pick(rng).build(rng);
    const notePath = this.paths.make(rng, built.segments);
    return { notePath, json: this.#serialize(rng, built.content) };
  }

  // Real-note key order; a coin-flip omits expiresAt so some look pre-lifecycle.
  // Never locked: a scrypt hash needs crypto randomness, which would break
  // reproducibility and leave decoys unreadable (unreadable bait is wasted bait).
  #serialize(rng, content) {
    const times = this.timestamps.create(rng);
    const record = { content, passwordHash: null, createdAt: times.createdAt, updatedAt: times.updatedAt };
    if (rng.chance(0.5)) record.expiresAt = null;
    return JSON.stringify(record);
  }
}

// Writes a note only when the slot is free or already holds this exact decoy. A slot
// holding anything else (a real note, a differently-seeded decoy) is left untouched —
// so seeding can never clobber a user's note, even on a slug collision.
export class FileWriter {
  constructor(storeRoot) {
    this.storeRoot = storeRoot;
    this.dirs = new Set();
  }

  async write(notePath, json) {
    const file = notePath.toFile(this.storeRoot);
    const existing = await this.#read(file);
    if (existing !== null && existing !== json) return "skipped";
    await this.#ensureDir(path.dirname(file));
    await fs.writeFile(file, json, "utf8");
    return "written";
  }

  async #ensureDir(dir) {
    if (this.dirs.has(dir)) return;
    await fs.mkdir(dir, { recursive: true });
    this.dirs.add(dir);
  }

  async #read(file) {
    try {
      return await fs.readFile(file, "utf8");
    } catch (err) {
      if (err.code === "ENOENT") return null;
      throw err;
    }
  }
}

// Orchestrates a seeding run in bounded-concurrency batches. Reports written vs
// skipped (collisions / real notes left alone).
export class HoneypotSeeder {
  static #BATCH = 256;

  constructor({ masterSeed, storeRoot, w3wRatio }) {
    this.factory = new HoneypotNoteFactory(masterSeed, w3wRatio);
    this.writer = new FileWriter(storeRoot);
  }

  async seed(count, onProgress) {
    let written = 0;
    for (let start = 0; start < count; start += HoneypotSeeder.#BATCH) {
      const end = Math.min(start + HoneypotSeeder.#BATCH, count);
      written += await this.#writeBatch(start, end);
      if (onProgress) onProgress(end, count, written);
    }
    return written;
  }

  async #writeBatch(start, end) {
    const jobs = [];
    for (let i = start; i < end; i++) {
      const note = this.factory.create(i);
      jobs.push(this.writer.write(note.notePath, note.json));
    }
    const results = await Promise.all(jobs);
    return results.filter((r) => r === "written").length;
  }
}

// Reverses a run by regenerating it from the same seed+count and deleting only files
// whose bytes still match the decoy we would produce. A real note sharing a slug has
// different bytes ⇒ never deleted. Needs no manifest — just the original seed.
export class HoneypotCleaner {
  constructor({ masterSeed, storeRoot, w3wRatio }) {
    this.factory = new HoneypotNoteFactory(masterSeed, w3wRatio);
    this.storeRoot = storeRoot;
    this.dirs = new Set();
  }

  async clean(count, onProgress) {
    let removed = 0;
    for (let i = 0; i < count; i++) {
      removed += await this.#removeOne(this.factory.create(i));
      if (onProgress && (i + 1) % 256 === 0) onProgress(i + 1, count, removed);
    }
    await this.#pruneDirs();
    return removed;
  }

  async #removeOne(note) {
    const file = note.notePath.toFile(this.storeRoot);
    let current;
    try {
      current = await fs.readFile(file, "utf8");
    } catch (err) {
      if (err.code === "ENOENT") return 0;
      throw err;
    }
    if (current !== note.json) return 0;
    this.dirs.add(path.dirname(file));
    await fs.unlink(file);
    return 1;
  }

  async #pruneDirs() {
    const ordered = [...this.dirs].sort((a, b) => b.length - a.length);
    for (const dir of ordered) {
      if (dir !== this.storeRoot) await fs.rmdir(dir).catch(() => {});
    }
  }
}
