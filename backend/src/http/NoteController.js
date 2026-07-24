import { NotePath } from "../domain/note/NotePath.js";
import { HttpStatus, HttpMethod, ApiRoute, NoteField } from "../domain/constants.js";
import { ValidationError, UnauthorizedError } from "../domain/errors/AppError.js";

// HTTP controller for the note API. Translates requests into NoteManager calls and
// enforces per-client rate limits. Depends only on injected abstractions.
export class NoteController {
  constructor(noteManager, unlockLimiter, writeLimiter) {
    this.noteManager = noteManager;
    this.unlockLimiter = unlockLimiter;
    this.writeLimiter = writeLimiter;
  }

  // Returns true if it handled the request, false to let another controller try.
  async handle(ctx) {
    const route = this.#match(ctx.pathname);
    if (route === null) return false;
    await this.#dispatch(ctx, route);
    return true;
  }

  #match(pathname) {
    if (pathname.startsWith(ApiRoute.UNLOCK)) return { action: "unlock", raw: pathname.slice(ApiRoute.UNLOCK.length) };
    if (pathname.startsWith(ApiRoute.LOCK)) return { action: "lock", raw: pathname.slice(ApiRoute.LOCK.length) };
    if (pathname.startsWith(ApiRoute.NOTE)) return { action: "crud", raw: pathname.slice(ApiRoute.NOTE.length) };
    return null;
  }

  async #dispatch(ctx, route) {
    const notePath = NotePath.fromRaw(route.raw);
    if (route.action === "unlock") return this.#unlock(ctx, notePath);
    if (route.action === "lock") return this.#lock(ctx, notePath);
    return this.#crud(ctx, notePath);
  }

  async #crud(ctx, notePath) {
    if (ctx.method === HttpMethod.GET) return this.#read(ctx, notePath);
    if (ctx.method === HttpMethod.PUT) return this.#save(ctx, notePath);
    throw new ValidationError("Unsupported method for this note route.");
  }

  async #read(ctx, notePath) {
    const view = await this.noteManager.read(notePath);
    ctx.sendJson(HttpStatus.OK, { slug: notePath.slug, ...view });
  }

  async #save(ctx, notePath) {
    this.writeLimiter.assertAllowed(ctx.clientIp);
    this.writeLimiter.record(ctx.clientIp);
    const body = await ctx.readJson();
    const view = await this.noteManager.save(notePath, body[NoteField.CONTENT], body[NoteField.PASSWORD]);
    ctx.sendJson(HttpStatus.OK, { slug: notePath.slug, ...view });
  }

  async #unlock(ctx, notePath) {
    const key = ctx.clientIp + ":" + notePath.slug;
    this.unlockLimiter.assertAllowed(key);
    const body = await ctx.readJson();
    const view = await this.#tryUnlock(notePath, body[NoteField.PASSWORD], key);
    ctx.sendJson(HttpStatus.OK, { slug: notePath.slug, ...view });
  }

  async #tryUnlock(notePath, password, key) {
    try {
      const view = await this.noteManager.unlock(notePath, password);
      this.unlockLimiter.reset(key);
      return view;
    } catch (err) {
      if (err instanceof UnauthorizedError) this.unlockLimiter.record(key);
      throw err;
    }
  }

  async #lock(ctx, notePath) {
    const body = await ctx.readJson();
    const view = await this.noteManager.setPassword(notePath, body[NoteField.PASSWORD], body[NoteField.CURRENT]);
    ctx.sendJson(HttpStatus.OK, { slug: notePath.slug, ...view });
  }
}
