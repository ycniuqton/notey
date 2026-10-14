// Small deterministic PRNG (mulberry32) so a given --seed reproduces the same
// honeypot field. Used everywhere instead of Math.random for repeatability.
export class Rng {
  constructor(seed) {
    this.state = (seed >>> 0) || 1;
  }

  // A fresh, independent stream for note `index` under master `seed`. Deriving per
  // note (not one shared stream) makes every note a pure function of (seed, index),
  // so a run is reproducible — and reversible — without any on-disk manifest.
  static forNote(seed, index) {
    return new Rng((((seed >>> 0) ^ Math.imul(index + 1, 2654435761)) >>> 0) || 1);
  }

  // Next float in [0, 1).
  next() {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Integer in [min, max] inclusive.
  int(min, max) {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  // True with the given probability (0..1).
  chance(probability) {
    return this.next() < probability;
  }

  // One random element of a non-empty array.
  pick(items) {
    return items[this.int(0, items.length - 1)];
  }

  // `count` distinct elements of a pool, order preserved by draw.
  sample(items, count) {
    const pool = items.slice();
    const picked = [];
    while (picked.length < count && pool.length > 0) {
      picked.push(pool.splice(this.int(0, pool.length - 1), 1)[0]);
    }
    return picked;
  }

  // A short, URL-safe base36 token of the given length.
  token(length) {
    let out = "";
    while (out.length < length) out += this.int(0, 35).toString(36);
    return out.slice(0, length);
  }
}
