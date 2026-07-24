import { AppConfig } from "./config/AppConfig.js";
import { RatePolicy } from "./domain/constants.js";
import { FileNoteRepository } from "./domain/note/FileNoteRepository.js";
import { PasswordPolicy } from "./domain/note/PasswordPolicy.js";
import { NoteManager } from "./domain/note/NoteManager.js";
import { RateLimiter } from "./domain/security/RateLimiter.js";
import { NoteController } from "./http/NoteController.js";
import { StaticController } from "./http/StaticController.js";
import { Router } from "./http/Router.js";
import { HttpServer } from "./http/HttpServer.js";

// Composition root: pick concrete implementations here, inject abstractions everywhere
// else (Rule 12/15). This is the only place that knows about concrete classes.
async function bootstrap() {
  const config = new AppConfig();
  const repository = new FileNoteRepository(config.storeDir);
  const noteManager = new NoteManager(repository, new PasswordPolicy());
  const noteController = new NoteController(
    noteManager,
    new RateLimiter(RatePolicy.UNLOCK),
    new RateLimiter(RatePolicy.WRITE),
  );
  const router = new Router(noteController, new StaticController(config.frontendDir));
  await new HttpServer(router, config).start();
}

bootstrap().catch((err) => {
  console.error("[notey] failed to start:", err);
  process.exit(1);
});
