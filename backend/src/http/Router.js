// Ordered request dispatcher: the note API claims its routes first, otherwise the
// static SPA controller handles the request. All errors are turned into responses.
export class Router {
  constructor(noteController, staticController) {
    this.noteController = noteController;
    this.staticController = staticController;
  }

  async route(ctx) {
    try {
      const handled = await this.noteController.handle(ctx);
      if (!handled) await this.staticController.handle(ctx);
    } catch (err) {
      ctx.sendError(err);
    }
  }
}
