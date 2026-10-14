import path from "node:path";
import { fileURLToPath } from "node:url";
import { Rng } from "./Rng.js";
import { HoneypotSeeder, HoneypotCleaner, HoneypotNoteFactory, SeedManifest } from "./HoneypotSeeder.js";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// Parsed, validated invocation. Turns raw argv into an intent (seed/clean/help)
// plus its settings; all flag names and defaults live here (devlens Rule 17).
export class CliOptions {
  static DEFAULTS = { store: "note-store", manifest: ".honeypot-manifest.json", locked: 0.05, seed: 0 };

  constructor(argv) {
    this.mode = "seed";
    this.count = 0;
    this.dryRun = false;
    this.store = CliOptions.DEFAULTS.store;
    this.manifest = CliOptions.DEFAULTS.manifest;
    this.locked = CliOptions.DEFAULTS.locked;
    this.seed = CliOptions.DEFAULTS.seed || ((Date.now() >>> 0) || 1);
    this.#parse(argv);
  }

  get storePath() {
    return path.resolve(PROJECT_ROOT, this.store);
  }

  get manifestPath() {
    return path.resolve(PROJECT_ROOT, this.manifest);
  }

  #parse(argv) {
    for (let i = 0; i < argv.length; i++) this.#consume(argv, i) && i++;
  }

  // Returns true when the current token consumed the following value token.
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
    else if (name === "manifest") this.manifest = value;
    else if (name === "seed") this.seed = (Number(value) >>> 0) || 1;
    else if (name === "locked") this.locked = Math.max(0, Math.min(1, Number(value)));
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
    if (this.options.mode === "clean") return this.#clean();
    if (this.options.dryRun) return this.#dryRun();
    return this.#seed();
  }

  async #seed() {
    const count = this.#requireCount();
    const manifest = new SeedManifest(this.options.manifestPath);
    const seeder = new HoneypotSeeder({
      rng: new Rng(this.options.seed), storeRoot: this.options.storePath,
      manifest, lockedRatio: this.options.locked,
    });
    this.#log(`Seeding ${count} honeypot notes into ${this.options.storePath} (seed=${this.options.seed})`);
    await seeder.seed(count, (done, total) => this.#progress(done, total));
    this.#log(`\nDone. ${count} notes written. Manifest: ${this.options.manifestPath}`);
  }

  async #clean() {
    const manifest = new SeedManifest(this.options.manifestPath);
    const cleaner = new HoneypotCleaner({ storeRoot: this.options.storePath, manifest });
    const { removed, listed } = await cleaner.clean();
    this.#log(`Removed ${removed} of ${listed} manifest entries from ${this.options.storePath}`);
  }

  #dryRun() {
    const factory = new HoneypotNoteFactory(new Rng(this.options.seed), this.options.locked);
    const sample = this.#requireCount();
    this.#log(`Dry run — ${sample} sample notes (nothing written):\n`);
    for (let i = 0; i < sample; i++) {
      const note = factory.create(i);
      this.#log(`  /${note.notePath.slug}\n    ${note.json.slice(0, 120)}...`);
    }
  }

  #requireCount() {
    if (this.options.count <= 0) throw new Error("Provide a positive note count, e.g. `seed-honeypot.js 5000`");
    return this.options.count;
  }

  #progress(done, total) {
    process.stdout.write(`\r  ${done}/${total} (${Math.floor((done / total) * 100)}%)`);
  }

  #log(message) {
    process.stdout.write(message + "\n");
  }

  #help() {
    this.#log([
      "notey honeypot seeder — plant natural-looking decoy notes.",
      "",
      "Usage:",
      "  node scripts/seed-honeypot.js <count> [options]   seed <count> notes",
      "  node scripts/seed-honeypot.js --clean             remove everything it seeded",
      "",
      "Options:",
      "  --store <dir>      note store root        (default: note-store)",
      "  --manifest <file>  created-paths log      (default: .honeypot-manifest.json)",
      "  --locked <0..1>    fraction scrypt-locked (default: 0.05)",
      "  --seed <int>       PRNG seed for repeatable output",
      "  --dry-run          print <count> samples, write nothing",
      "  --help             show this help",
    ].join("\n"));
  }
}
