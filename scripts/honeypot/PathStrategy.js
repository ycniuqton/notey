import { NotePath } from "../../backend/src/domain/note/NotePath.js";
import { What3Words } from "./HoneypotCatalog.js";

// Chooses WHERE a decoy lives. Base class so path styles are swappable without the
// factory knowing which one it got (devlens Rule 13/15).
export class PathStrategy {
  slug() {
    throw new Error("PathStrategy.slug is abstract");
  }
}

// Default-note style: wordA-wordB-NNN, identical to the frontend generator. This is
// the namespace a scanner actually enumerates, so most decoys belong here.
export class What3WordsPathStrategy extends PathStrategy {
  slug(rng) {
    const a = rng.pick(What3Words.WORDS_A);
    const b = rng.pick(What3Words.WORDS_B);
    return `${a}-${b}-${rng.int(What3Words.NUM_MIN, What3Words.NUM_MAX)}`;
  }
}

// Human-typed style (e.g. "quinh", "prod/env"): a minority, matching the handful of
// hand-named notes a real store carries and adding camouflage depth around hits.
export class HumanPathStrategy extends PathStrategy {
  slug(rng, humanSegments) {
    return humanSegments.join("/");
  }
}

// Picks a style per note. `w3wRatio` is how strongly the field mimics the default
// generator; the remainder are hand-named. Callers talk only to this manager.
export class PathStrategyManager {
  constructor(w3wRatio) {
    this.w3wRatio = w3wRatio;
    this.what3words = new What3WordsPathStrategy();
    this.human = new HumanPathStrategy();
  }

  make(rng, humanSegments) {
    const slug = rng.chance(this.w3wRatio)
      ? this.what3words.slug(rng)
      : this.human.slug(rng, humanSegments);
    return NotePath.fromRaw(slug);
  }
}
