// Abstract storage contract for notes. Business logic depends on this base, never
// on a concrete store (Rule 12/13). Swap implementations via bootstrap wiring.
export class NoteRepository {
  async find(notePath) {
    throw new Error("NoteRepository.find must be implemented by a subclass.");
  }

  async save(notePath, record) {
    throw new Error("NoteRepository.save must be implemented by a subclass.");
  }

  // Count stored notes, stopping early once `cap` is reached (cheap abuse check).
  async count(cap) {
    throw new Error("NoteRepository.count must be implemented by a subclass.");
  }
}
