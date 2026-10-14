// Static word pools that make generated notes read like real human jottings.
// Centralised here so no template carries magic strings (devlens Rule 17/18).
export class HoneypotCatalog {
  static FIRST_NAMES = [
    "sarah", "mike", "alex", "jenny", "david", "priya", "tom", "linh",
    "carlos", "emma", "raj", "nora", "kevin", "mai", "omar", "lucy",
  ];

  static TEAMS = ["eng", "ops", "devops", "backend", "platform", "data", "web", "infra"];

  static PROJECTS = [
    "phoenix", "atlas", "nimbus", "orion", "apollo", "falcon", "project-x",
    "acme", "helios", "titan", "raven", "quartz", "lumen", "vortex",
  ];

  static ENVIRONMENTS = ["prod", "staging", "dev", "qa", "sandbox"];

  static SERVICES = [
    "postgres", "redis", "stripe", "sendgrid", "mailgun", "twilio", "s3",
    "cloudflare", "datadog", "sentry", "github", "slack", "mongodb", "rabbitmq",
  ];

  static CITIES = ["hcmc", "hanoi", "singapore", "tokyo", "berlin", "austin", "london"];

  static GROCERIES = [
    "milk", "eggs", "coffee", "rice", "bananas", "chicken", "onions", "bread",
    "tomatoes", "olive oil", "garlic", "yogurt", "spinach", "soy sauce",
  ];

  static TODO_VERBS = [
    "call", "email", "review", "fix", "deploy", "refactor", "ping", "follow up with",
    "book", "renew", "cancel", "pay", "ship", "test", "document",
  ];

  static TODO_OBJECTS = [
    "the invoice", "the landlord", "Q3 report", "the staging bug", "dentist appt",
    "the client demo", "the VPN cert", "the pull request", "the tax form",
    "the migration", "the onboarding doc", "car insurance", "the standup notes",
  ];

  static MEETING_TOPICS = [
    "roadmap sync", "sprint planning", "incident review", "1:1", "retro",
    "budget review", "architecture review", "hiring sync", "client check-in",
  ];

  static SNIPPET_LANGS = ["bash", "sql", "python", "js", "nginx", "yaml"];

  static BIP39 = [
    "ridge", "clutch", "mimic", "oyster", "velvet", "canyon", "harbor", "plank",
    "ginger", "nomad", "pledge", "walnut", "fabric", "dolphin", "sunset", "orbit",
    "meadow", "ember", "tunnel", "pickle", "rhythm", "lantern", "cobalt", "spruce",
  ];

  // Weighted template registry key -> relative weight. Mundane notes dominate so
  // the juicy "secret" notes feel like rare finds an attacker digs out.
  static WEIGHTS = {
    todo: 20, grocery: 8, meeting: 14, journal: 10, snippet: 12, config: 8,
    email: 8, envdump: 7, dbcreds: 5, apikeys: 5, sshkey: 3, passwords: 4, wallet: 2,
  };
}

// The default note-name generator, mirrored EXACTLY from frontend/app.js
// (randomSlug: WORDS_A-WORDS_B-NNN, NNN in 100..999). Honeypots must live in this
// same 90k-slug space to be indistinguishable from real default notes.
// KEEP IN SYNC with frontend/app.js if those word lists ever change.
export class What3Words {
  static WORDS_A = ["quiet", "amber", "misty", "brave", "lunar", "swift", "wild", "calm", "solar", "north"];
  static WORDS_B = ["harbor", "meadow", "cipher", "ember", "willow", "signal", "pebble", "canyon", "orbit", "delta"];
  static NUM_MIN = 100;
  static NUM_MAX = 999;

  // Size of the whole default-note namespace — the ceiling on distinct w3w decoys.
  static space() {
    return What3Words.WORDS_A.length * What3Words.WORDS_B.length * (What3Words.NUM_MAX - What3Words.NUM_MIN + 1);
  }
}

// Builders for realistic-but-fake credential strings. Every value is random and
// non-functional; these are decoys, never real secrets.
export class FakeSecret {
  static #UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  static #B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

  static hex(rng, bytes) {
    let out = "";
    for (let i = 0; i < bytes; i++) out += rng.int(0, 255).toString(16).padStart(2, "0");
    return out;
  }

  static #run(rng, alphabet, length) {
    let out = "";
    for (let i = 0; i < length; i++) out += alphabet[rng.int(0, alphabet.length - 1)];
    return out;
  }

  static awsAccessKey(rng) {
    return "AKIA" + FakeSecret.#run(rng, FakeSecret.#UPPER, 16);
  }

  static awsSecret(rng) {
    return FakeSecret.#run(rng, FakeSecret.#B64, 40);
  }

  static stripeKey(rng) {
    return "sk_live_" + FakeSecret.#run(rng, FakeSecret.#B64.slice(0, 62), 24);
  }

  static githubToken(rng) {
    return "ghp_" + FakeSecret.#run(rng, FakeSecret.#B64.slice(0, 62), 36);
  }

  static jwt(rng) {
    const seg = () => FakeSecret.#run(rng, FakeSecret.#B64.slice(0, 62), rng.int(24, 40));
    return [seg(), seg(), seg()].join(".");
  }

  static dbUrl(rng, service, host, db) {
    const user = rng.pick(["app", "admin", "svc", "root", "api"]);
    const pass = FakeSecret.hex(rng, 9);
    const port = service === "postgres" ? 5432 : service === "mongodb" ? 27017 : 6379;
    return `${service}://${user}:${pass}@${host}:${port}/${db}`;
  }

  static password(rng) {
    const words = ["Summer", "Dragon", "Coffee", "Falcon", "Winter", "Rocket", "Maple"];
    return `${rng.pick(words)}${rng.int(10, 99)}${rng.pick(["!", "@", "#", "$"])}`;
  }

  static seedPhrase(rng) {
    return rng.sample(HoneypotCatalog.BIP39, 12).join(" ");
  }

  static sshKey(rng) {
    const body = [];
    for (let i = 0; i < 6; i++) body.push(FakeSecret.#run(rng, FakeSecret.#B64, 64));
    return ["-----BEGIN OPENSSH PRIVATE KEY-----", ...body, "-----END OPENSSH PRIVATE KEY-----"].join("\n");
  }
}
