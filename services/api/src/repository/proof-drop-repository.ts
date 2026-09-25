import type { ProofDropRecord } from "@proofdrop/shared";

export interface ProofDropRepository {
  create(record: ProofDropRecord): Promise<ProofDropRecord>;
  save(record: ProofDropRecord): Promise<ProofDropRecord>;
  getByRequestId(publicId: string): Promise<ProofDropRecord | null>;
  getByProofId(publicId: string): Promise<ProofDropRecord | null>;
  listRecent(limit?: number): Promise<ProofDropRecord[]>;
}
