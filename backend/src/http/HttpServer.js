import http from "node:http";
import { RequestContext } from "./RequestContext.js";

// Owns the node:http server, binds host:port, and hands each request to the Router.
export class HttpServer {
  constructor(router, config) {
    this.router = router;
    this.config = config;
    this.server = http.createServer((req, res) => this.#onRequest(req, res));
  }

  start() {
    return new Promise((resolve) => {
      this.server.listen(this.config.port, this.config.host, () => {
        console.log(`[notey] listening on http://${this.config.host}:${this.config.port}`);
        resolve(this);
      });
    });
  }

  #onRequest(req, res) {
    const ctx = new RequestContext(req, res);
    this.router.route(ctx).catch((err) => ctx.sendError(err));
  }
}
