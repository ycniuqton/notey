import { HttpStatus, ContentType, Limit, SecurityHeader } from "../domain/constants.js";
import { AppError, PayloadTooLargeError, ValidationError } from "../domain/errors/AppError.js";

// Wraps a node:http request/response pair: parsed request info + response helpers.
export class RequestContext {
  constructor(req, res) {
    this.req = req;
    this.res = res;
    this.method = req.method ?? "";
    this.pathname = RequestContext.#pathname(req.url ?? "/");
    this.clientIp = RequestContext.#clientIp(req);
  }

  async readJson() {
    const raw = await this.#readBody();
    if (raw.length === 0) return {};
    try {
      return JSON.parse(raw);
    } catch {
      throw new ValidationError("Request body is not valid JSON.");
    }
  }

  sendJson(statusCode, payload) {
    this.#send(statusCode, ContentType.JSON, JSON.stringify(payload));
  }

  sendRaw(statusCode, contentType, body) {
    this.#send(statusCode, contentType, body);
  }

  sendError(err) {
    const isKnown = err instanceof AppError;
    const status = isKnown ? err.statusCode : HttpStatus.INTERNAL;
    const message = isKnown ? err.message : "Something went wrong.";
    if (!isKnown) console.error("[notey] unexpected error:", err);
    this.sendJson(status, { error: message, code: err.code ?? "internal_error" });
  }

  #send(statusCode, contentType, body) {
    this.res.writeHead(statusCode, { "Content-Type": contentType, ...SecurityHeader.VALUES });
    this.res.end(body);
  }

  #readBody() {
    return new Promise((resolve, reject) => {
      const chunks = [];
      let size = 0;
      this.req.on("data", (chunk) => {
        size += chunk.length;
        if (size > Limit.MAX_BODY_BYTES) reject(new PayloadTooLargeError());
        else chunks.push(chunk);
      });
      this.req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      this.req.on("error", reject);
    });
  }

  static #pathname(url) {
    const parsed = new URL(url, "http://localhost");
    return parsed.pathname;
  }

  static #clientIp(req) {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.length > 0) return forwarded.split(",")[0].trim();
    return req.socket?.remoteAddress ?? "unknown";
  }
}
