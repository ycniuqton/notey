import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(HERE, "..", "..", "..");

// Runtime configuration, resolved to absolute paths. Env-overridable (Rule 15).
export class AppConfig {
  constructor(env = process.env) {
    this.host = env.NOTEY_HOST ?? "0.0.0.0";
    this.port = Number(env.NOTEY_PORT ?? 8080);
    this.storeDir = path.resolve(env.NOTEY_STORE ?? path.join(PROJECT_ROOT, "note-store"));
    this.frontendDir = path.resolve(env.NOTEY_FRONTEND ?? path.join(PROJECT_ROOT, "frontend"));
  }
}
