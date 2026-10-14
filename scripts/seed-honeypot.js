#!/usr/bin/env node
// CLI entry: seed (or clean) natural-looking honeypot notes in the note store.
// Run `node scripts/seed-honeypot.js --help` for usage.
import { HoneypotCli } from "./honeypot/HoneypotCli.js";

new HoneypotCli(process.argv.slice(2)).run().catch((err) => {
  process.stderr.write(`honeypot: ${err.message}\n`);
  process.exit(1);
});
