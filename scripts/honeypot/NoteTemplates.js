import { HoneypotCatalog, FakeSecret } from "./HoneypotCatalog.js";

// A plausible-but-old calendar date, used in both paths and note bodies so the
// field reads as abandoned data from years ago.
export class FakeDate {
  static slug(rng) {
    const y = rng.int(2021, 2024);
    const m = String(rng.int(1, 12)).padStart(2, "0");
    const d = String(rng.int(1, 28)).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
}

// Base class for every note kind. Subclasses implement build(rng) -> {segments, content}.
// `lockable` marks kinds that may plausibly carry a password (devlens Rule 13).
export class NoteTemplate {
  constructor({ kind, lockable = false }) {
    this.kind = kind;
    this.lockable = lockable;
  }

  build() {
    throw new Error("NoteTemplate.build is abstract");
  }
}

export class TodoTemplate extends NoteTemplate {
  constructor() {
    super({ kind: "todo" });
  }

  build(rng) {
    const name = rng.pick(HoneypotCatalog.FIRST_NAMES);
    const lines = [];
    for (let i = 0; i < rng.int(3, 8); i++) {
      const box = rng.chance(0.4) ? "[x]" : "[ ]";
      lines.push(`- ${box} ${rng.pick(HoneypotCatalog.TODO_VERBS)} ${rng.pick(HoneypotCatalog.TODO_OBJECTS)}`);
    }
    return { segments: [name, rng.pick(["todo", "todos", "tasks"])], content: lines.join("\n") };
  }
}

export class GroceryTemplate extends NoteTemplate {
  constructor() {
    super({ kind: "grocery" });
  }

  build(rng) {
    const name = rng.pick(HoneypotCatalog.FIRST_NAMES);
    const items = rng.sample(HoneypotCatalog.GROCERIES, rng.int(4, 9)).map((g) => `- ${g}`);
    return { segments: [name, rng.pick(["groceries", "shopping", "list"])], content: items.join("\n") };
  }
}

export class MeetingTemplate extends NoteTemplate {
  constructor() {
    super({ kind: "meeting" });
  }

  build(rng) {
    const topic = rng.pick(HoneypotCatalog.MEETING_TOPICS);
    const attendees = rng.sample(HoneypotCatalog.FIRST_NAMES, rng.int(2, 4)).join(", ");
    const actions = [];
    for (let i = 0; i < rng.int(2, 4); i++) {
      actions.push(`- ${rng.pick(HoneypotCatalog.FIRST_NAMES)} to ${rng.pick(HoneypotCatalog.TODO_VERBS)} ${rng.pick(HoneypotCatalog.TODO_OBJECTS)}`);
    }
    const content = `# ${topic} — ${FakeDate.slug(rng)}\nAttendees: ${attendees}\n\nAction items:\n${actions.join("\n")}`;
    return { segments: [rng.pick(HoneypotCatalog.TEAMS), "meetings", FakeDate.slug(rng)], content };
  }
}

export class JournalTemplate extends NoteTemplate {
  constructor() {
    super({ kind: "journal" });
  }

  build(rng) {
    const name = rng.pick(HoneypotCatalog.FIRST_NAMES);
    const mood = rng.pick(["long day", "productive", "tired", "good run this morning", "stressful"]);
    const note = rng.pick([
      "need to sleep earlier", "finally shipped the thing", "coffee was great",
      "call mom this weekend", "gym tomorrow", "read 20 pages",
    ]);
    const content = `${FakeDate.slug(rng)}\n\n${mood}. ${note}.`;
    return { segments: [name, "journal", FakeDate.slug(rng)], content };
  }
}

export class SnippetTemplate extends NoteTemplate {
  constructor() {
    super({ kind: "snippet" });
  }

  build(rng) {
    const lang = rng.pick(HoneypotCatalog.SNIPPET_LANGS);
    const bodies = {
      bash: "for f in *.log; do gzip \"$f\"; done",
      sql: "SELECT id, email FROM users WHERE created_at > now() - interval '7 days';",
      python: "import json\nprint(json.dumps(sorted(set(data)), indent=2))",
      js: "const uniq = [...new Set(arr)].sort();",
      nginx: "location /api/ { proxy_pass http://127.0.0.1:8080; }",
      yaml: "services:\n  web:\n    restart: unless-stopped",
    };
    const content = `${lang} snippet\n\n\`\`\`${lang}\n${bodies[lang]}\n\`\`\``;
    return { segments: [rng.pick(HoneypotCatalog.PROJECTS), "snippets", rng.token(5)], content };
  }
}

export class ConfigTemplate extends NoteTemplate {
  constructor() {
    super({ kind: "config" });
  }

  build(rng) {
    const project = rng.pick(HoneypotCatalog.PROJECTS);
    const env = rng.pick(HoneypotCatalog.ENVIRONMENTS);
    const content = [
      `# ${project} ${env} config`,
      `LOG_LEVEL=${rng.pick(["info", "debug", "warn"])}`,
      `MAX_WORKERS=${rng.int(2, 16)}`,
      `CACHE_TTL=${rng.int(30, 3600)}`,
      `REGION=${rng.pick(HoneypotCatalog.CITIES)}`,
    ].join("\n");
    return { segments: [project, env, "config"], content };
  }
}

export class EmailDraftTemplate extends NoteTemplate {
  constructor() {
    super({ kind: "email" });
  }

  build(rng) {
    const to = rng.pick(HoneypotCatalog.FIRST_NAMES);
    const topic = rng.pick(HoneypotCatalog.MEETING_TOPICS);
    const content = `To: ${to}@example.com\nSubject: re: ${topic}\n\nHi ${to},\n\nFollowing up on this — can we sync ${rng.pick(["tomorrow", "this week", "Monday"])}?\n\nThanks`;
    return { segments: [rng.pick(HoneypotCatalog.FIRST_NAMES), "drafts", rng.token(5)], content };
  }
}

// --- Bait templates: the "secrets" an attacker is meant to find and waste time on. ---

export class EnvDumpTemplate extends NoteTemplate {
  constructor() {
    super({ kind: "envdump", lockable: true });
  }

  build(rng) {
    const project = rng.pick(HoneypotCatalog.PROJECTS);
    const env = rng.pick(HoneypotCatalog.ENVIRONMENTS);
    const host = `${env}-db.${project}.internal`;
    const content = [
      `NODE_ENV=${env}`,
      `DATABASE_URL=${FakeSecret.dbUrl(rng, "postgres", host, project)}`,
      `REDIS_URL=${FakeSecret.dbUrl(rng, "redis", `${env}-cache.${project}.internal`, "0")}`,
      `JWT_SECRET=${FakeSecret.hex(rng, 32)}`,
      `AWS_ACCESS_KEY_ID=${FakeSecret.awsAccessKey(rng)}`,
      `AWS_SECRET_ACCESS_KEY=${FakeSecret.awsSecret(rng)}`,
      `STRIPE_SECRET_KEY=${FakeSecret.stripeKey(rng)}`,
    ].join("\n");
    return { segments: [project, env, rng.pick(["env", "dotenv", "environment"])], content };
  }
}

export class DbCredsTemplate extends NoteTemplate {
  constructor() {
    super({ kind: "dbcreds", lockable: true });
  }

  build(rng) {
    const project = rng.pick(HoneypotCatalog.PROJECTS);
    const lines = [];
    for (const env of rng.sample(HoneypotCatalog.ENVIRONMENTS, rng.int(2, 3))) {
      lines.push(`${env}: ${FakeSecret.dbUrl(rng, "postgres", `${env}.${project}.db`, project)}`);
    }
    return { segments: [project, "db", rng.pick(["creds", "connections", "access"])], content: lines.join("\n") };
  }
}

export class ApiKeysTemplate extends NoteTemplate {
  constructor() {
    super({ kind: "apikeys", lockable: true });
  }

  build(rng) {
    const content = [
      `# integration keys`,
      `stripe: ${FakeSecret.stripeKey(rng)}`,
      `github: ${FakeSecret.githubToken(rng)}`,
      `internal_jwt: ${FakeSecret.jwt(rng)}`,
      `sendgrid: SG.${FakeSecret.hex(rng, 10)}.${FakeSecret.hex(rng, 16)}`,
    ].join("\n");
    return { segments: [rng.pick(HoneypotCatalog.PROJECTS), rng.pick(["keys", "secrets", "api"])], content };
  }
}

export class SshKeyTemplate extends NoteTemplate {
  constructor() {
    super({ kind: "sshkey", lockable: true });
  }

  build(rng) {
    const name = rng.pick(HoneypotCatalog.FIRST_NAMES);
    return { segments: [name, "ssh", rng.pick(["id_rsa", "deploy_key", "server_key"])], content: FakeSecret.sshKey(rng) };
  }
}

export class PasswordsTemplate extends NoteTemplate {
  constructor() {
    super({ kind: "passwords", lockable: true });
  }

  build(rng) {
    const sites = ["gmail", "aws-console", "bank", "github", "vpn", "admin-panel", "router"];
    const lines = rng.sample(sites, rng.int(3, 6)).map((s) =>
      `${s}: ${rng.pick(HoneypotCatalog.FIRST_NAMES)} / ${FakeSecret.password(rng)}`);
    return { segments: [rng.pick(HoneypotCatalog.FIRST_NAMES), rng.pick(["passwords", "logins", "vault"])], content: lines.join("\n") };
  }
}

export class WalletTemplate extends NoteTemplate {
  constructor() {
    super({ kind: "wallet", lockable: true });
  }

  build(rng) {
    const content = [
      `# ${rng.pick(["metamask", "ledger backup", "trust wallet"])}`,
      `seed: ${FakeSecret.seedPhrase(rng)}`,
      `addr: 0x${FakeSecret.hex(rng, 20)}`,
    ].join("\n");
    return { segments: [rng.pick(HoneypotCatalog.FIRST_NAMES), rng.pick(["wallet", "crypto", "backup"])], content };
  }
}

// Registry + weighted selection (devlens Rule 14/15: callers talk only to the
// manager and never switch on a concrete template type).
export class NoteTemplateManager {
  constructor() {
    this.templates = NoteTemplateManager.#register();
    this.table = this.#buildWeightTable();
  }

  static #register() {
    const list = [
      new TodoTemplate(), new GroceryTemplate(), new MeetingTemplate(), new JournalTemplate(),
      new SnippetTemplate(), new ConfigTemplate(), new EmailDraftTemplate(), new EnvDumpTemplate(),
      new DbCredsTemplate(), new ApiKeysTemplate(), new SshKeyTemplate(), new PasswordsTemplate(),
      new WalletTemplate(),
    ];
    return new Map(list.map((t) => [t.kind, t]));
  }

  #buildWeightTable() {
    const table = [];
    for (const [kind, weight] of Object.entries(HoneypotCatalog.WEIGHTS)) {
      for (let i = 0; i < weight; i++) table.push(kind);
    }
    return table;
  }

  pick(rng) {
    return this.templates.get(rng.pick(this.table));
  }
}
