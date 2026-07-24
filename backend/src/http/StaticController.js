import fs from "node:fs/promises";
import path from "node:path";
import { HttpStatus, ContentType } from "../domain/constants.js";

// Serves the static SPA. Only an explicit allowlist of files is served; every other
// path falls back to index.html so client-side routing owns note URLs. No path from
// the request ever reaches the filesystem, so traversal is impossible here.
export class StaticController {
  static #INDEX = "index.html";
  static #ASSETS = new Map([
    ["/", { file: "index.html", type: ContentType.HTML }],
    ["/index.html", { file: "index.html", type: ContentType.HTML }],
    ["/app.js", { file: "app.js", type: ContentType.JS }],
    ["/styles.css", { file: "styles.css", type: ContentType.CSS }],
  ]);

  constructor(frontendDir) {
    this.frontendDir = frontendDir;
  }

  async handle(ctx) {
    const asset = StaticController.#ASSETS.get(ctx.pathname);
    if (asset) return this.#serve(ctx, asset.file, asset.type);
    return this.#serve(ctx, StaticController.#INDEX, ContentType.HTML);
  }

  async #serve(ctx, file, type) {
    const body = await fs.readFile(path.join(this.frontendDir, file));
    ctx.sendRaw(HttpStatus.OK, type, body);
  }
}
