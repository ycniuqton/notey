import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Loads the SAME 2048-word BIP39 list the frontend serves (frontend/bip39.js) by
// parsing the array out of that one file. Single source of truth: decoy note names
// draw from the exact words real default notes use, with no second copy to drift.
const FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "frontend", "bip39.js");

function load() {
  const text = fs.readFileSync(FILE, "utf8");
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end <= start) throw new Error("bip39.js: word array not found");
  const words = JSON.parse(text.slice(start, end + 1));
  if (words.length !== 2048) throw new Error(`bip39.js: expected 2048 words, got ${words.length}`);
  return words;
}

export const BIP39 = load();
