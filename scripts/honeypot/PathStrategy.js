import { NotePath } from "../../backend/src/domain/note/NotePath.js";
import { BIP39 } from "./bip39.js";

// Chooses WHERE a decoy lives. Base class so path styles are swappable without the
// factory knowing which one it got (devlens Rule 13/15).
export class PathStrategy {
  slug() {
    throw new Error("PathStrategy.slug is abstract");
  }
}

// Default-note style: three BIP39 words (word-word-word), identical to the frontend
// generator. Most decoys belong here — it is the space real default notes occupy.
export class What3WordsPathStrategy extends PathStrategy {
  slug(rng) {
    return `${rng.pick(BIP39)}-${rng.pick(BIP39)}-${rng.pick(BIP39)}`;
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
