import crypto from "node:crypto";

// Hashes and verifies note passwords with scrypt. Format: "scrypt$<saltHex>$<hashHex>".
export class PasswordPolicy {
  static #SALT_BYTES = 16;
  static #KEY_BYTES = 64;
  static #PREFIX = "scrypt";
  static #SEP = "$";

  hash(password) {
    const salt = crypto.randomBytes(PasswordPolicy.#SALT_BYTES);
    const derived = crypto.scryptSync(password, salt, PasswordPolicy.#KEY_BYTES);
    return [PasswordPolicy.#PREFIX, salt.toString("hex"), derived.toString("hex")].join(PasswordPolicy.#SEP);
  }

  verify(password, stored) {
    if (typeof stored !== "string") return false;
    const parts = stored.split(PasswordPolicy.#SEP);
    if (parts.length !== 3 || parts[0] !== PasswordPolicy.#PREFIX) return false;
    return this.#matches(password, parts[1], parts[2]);
  }

  #matches(password, saltHex, hashHex) {
    const expected = Buffer.from(hashHex, "hex");
    const actual = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
    return crypto.timingSafeEqual(expected, actual);
  }
}
