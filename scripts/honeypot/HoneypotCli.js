import path from "node:path";
import { fileURLToPath } from "node:url";
import { What3Words } from "./HoneypotCatalog.js";
import { HoneypotSeeder, HoneypotCleaner, HoneypotNoteFactory } from "./HoneypotSeeder.js";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// Parsed, validated invocation. The master seed is mandatory and acts as the only
// "key" to a run — there is deliberately no manifest, so the seed is what lets you
// clean up later. All flag names/defaults live here (devlens Rule 17).
export class CliOptions {
  static DEFAULTS = { store: "note-store", w3w: 0.85 };

  constructor(argv) {
    this.mode = "seed";
    this.count = 0;
    this.seed = null;
    this.dryRun = false;
    this.store = CliOptions.DEFAULTS.store;
    this.w3w = CliOptions.DEFAULTS.w3w;
    this.#parse(argv);
  }

  get storePath() {
    return path.resolve(PROJECT_ROOT, this.store);
  }

  #parse(argv) {
    for (let i = 0; i < argv.length; i++) this.#consume(argv, i) && i++;
  }

  #consume(argv, i) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") return (this.mode = "help"), false;
    if (arg === "--clean") return (this.mode = "clean"), false;
    if (arg === "--dry-run") return (this.dryRun = true), false;
    if (arg.startsWith("--")) return this.#flag(arg.slice(2), argv[i + 1]), true;
    return this.#positional(arg), false;
  }

  #flag(name, value) {
    if (name === "store") this.store = value;
    else if (name === "seed") this.seed = Number(value) >>> 0;
    else if (name === "w3w") this.w3w = Math.max(0, Math.min(1, Number(value)));
    else throw new Error(`Unknown flag: --${name}`);
  }

  #positional(arg) {
    const n = Number(arg);
    if (!Number.isInteger(n) || n < 0) throw new Error(`Expected a note count, got "${arg}"`);
    this.count = n;
  }
}

// Entry object: selects the action from parsed options and reports progress.
export class HoneypotCli {
  constructor(argv) {
    this.options = new CliOptions(argv);
  }

  async run() {
    if (this.options.mode === "help") return this.#help();
    this.#requireSeed();
    if (this.options.mode === "clean") return this.#clean();
    if (this.options.dryRun) return this.#dryRun();
    return this.#seed();
  }

  async #seed() {
    const count = this.#requireCount();
    const o = this.options;
    const seeder = new HoneypotSeeder({ masterSeed: o.seed, storeRoot: o.storePath, w3wRatio: o.w3w });
    this.#log(`Seeding ${count} decoys into ${o.storePath}  (seed=${o.seed}, w3w=${o.w3w})`);
    const written = await seeder.seed(count, (done, total, w) => this.#progress(done, total, `written ${w}`));
    this.#log(`\nDone. ${written} written (${count - written} skipped: collisions / real notes left alone).`);
    this.#log(`\n  CLEANUP KEY — keep OFF the server: --seed ${o.seed} --count ${count} --w3w ${o.w3w}`);
    this.#log(`  To remove: node scripts/seed-honeypot.js --clean ${count} --seed ${o.seed} --w3w ${o.w3w}`);
  }

  async #clean() {
    const count = this.#requireCount();
    const o = this.options;
    const cleaner = new HoneypotCleaner({ masterSeed: o.seed, storeRoot: o.storePath, w3wRatio: o.w3w });
    this.#log(`Cleaning: regenerating ${count} decoys (seed=${o.seed}) and deleting byte-matches…`);
    const removed = await cleaner.clean(count, (done, total, r) => this.#progress(done, total, `removed ${r}`));
    this.#log(`\nDone. Removed ${removed} decoy notes; anything not byte-identical was left untouched.`);
  }

  #dryRun() {
    const factory = new HoneypotNoteFactory(this.options.seed, this.options.w3w);
    const sample = this.#requireCount();
    this.#log(`Dry run — ${sample} sample notes (seed=${this.options.seed}, nothing written):\n`);
    for (let i = 0; i < sample; i++) {
      const note = factory.create(i);
      this.#log(`  /${note.notePath.slug}\n    ${note.json.slice(0, 110)}...`);
    }
  }

  #requireSeed() {
    if (this.options.seed === null) {
      throw new Error("Missing --seed <int>. It is the run's only key (no manifest) — pick one and keep it to clean up later.");
    }
  }

  #requireCount() {
    if (this.options.count <= 0) throw new Error("Provide a positive note count, e.g. `seed-honeypot.js 5000 --seed 12345`");
    return this.options.count;
  }

  #progress(done, total, note) {
    process.stdout.write(`\r  ${done}/${total} (${Math.floor((done / total) * 100)}%)  ${note}   `);
  }

  #log(message) {
    process.stdout.write(message + "\n");
  }

  #help() {
    this.#log([
      "notey honeypot seeder — plant decoys that blend into the default note namespace.",
      "",
      `The default-note space is ${What3Words.space().toLocaleString()} slugs (3 BIP39 words, mirrored from the`,
      "frontend). Decoys live there too, so they are indistinguishable from real notes.",
      "No manifest or marker is ever written — the --seed is the only key to a run.",
      "",
      "Usage:",
      "  node scripts/seed-honeypot.js <count> --seed <int> [--w3w 0..1] [--store dir]",
      "  node scripts/seed-honeypot.js --clean <count> --seed <int> [--w3w 0..1]   reverse that run",
      "  node scripts/seed-honeypot.js <count> --seed <int> --dry-run              preview, write nothing",
      "",
      "Options:",
      "  --seed <int>   REQUIRED. Master seed = the run's cleanup key (store it off-box).",
      "  --w3w <0..1>   fraction placed in the default wordA-wordB-NNN space (default 0.85);",
      "                 the rest are hand-named paths for camouflage depth.",
      "  --store <dir>  note store root (default: note-store).",
      "  --dry-run      print <count> samples, write nothing.",
    ].join("\n"));
  }
}
