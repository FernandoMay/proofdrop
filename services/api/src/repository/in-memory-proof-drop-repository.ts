import type { ProofDropRecord } from "@proofdrop/shared";

import type { ProofDropRepository } from "./proof-drop-repository.js";

function clone(record: ProofDropRecord): ProofDropRecord {
  return structuredClone(record);
}

export class InMemoryProofDropRepository implements ProofDropRepository {
  readonly #records = new Map<string, ProofDropRecord>();

  async create(record: ProofDropRecord): Promise<ProofDropRecord> {
    if (this.#records.has(record.request.publicId)) {
      throw new Error(`A proof drop with public ID ${record.request.publicId} already exists.`);
    }
    const stored = clone(record);
    this.#records.set(stored.request.publicId, stored);
    return clone(stored);
  }

  async save(record: ProofDropRecord): Promise<ProofDropRecord> {
    if (!this.#records.has(record.request.publicId)) {
      throw new Error(`Cannot update missing proof drop ${record.request.publicId}.`);
    }
    const stored = clone(record);
    this.#records.set(stored.request.publicId, stored);
    return clone(stored);
  }

  async getByRequestId(publicId: string): Promise<ProofDropRecord | null> {
    const record = this.#records.get(publicId);
    return record ? clone(record) : null;
  }

  async getByProofId(publicId: string): Promise<ProofDropRecord | null> {
    for (const record of this.#records.values()) {
      if (record.proof?.publicId === publicId) {
        return clone(record);
      }
    }
    return null;
  }

  async listRecent(limit = 20): Promise<ProofDropRecord[]> {
    return [...this.#records.values()]
      .sort((left, right) => right.request.createdAt.localeCompare(left.request.createdAt))
      .slice(0, limit)
      .map(clone);
  }
}
