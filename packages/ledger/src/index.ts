import { createHash } from "node:crypto";

import { createStubSigner, type LedgerSigner } from "./stub.js";

export type { LedgerSigner };
export { createStubSigner };

export interface LedgerEntry {
  seq: number;
  prevHash: string;
  payloadHash: string;
  verdict: string;
  actorId: string;
  kmsSignature: string;
  createdAt: number;
}

export function entryMessage(entry: Omit<LedgerEntry, "kmsSignature">): string {
  return `${entry.seq}|${entry.prevHash}|${entry.payloadHash}|${entry.verdict}|${entry.actorId}|${entry.createdAt}`;
}

export const GENESIS_HASH = "0".repeat(64);

export class AppendOnlyLedger {
  private entries: LedgerEntry[] = [];

  constructor(private readonly signer: LedgerSigner = createStubSigner()) {}

  get length(): number {
    return this.entries.length;
  }

  list(): readonly LedgerEntry[] {
    return this.entries;
  }

  append(input: {
    payloadHash: string;
    verdict: string;
    actorId: string;
    createdAt?: number;
  }): LedgerEntry {
    const seq = this.entries.length + 1;
    const prevHash =
      this.entries.length === 0
        ? GENESIS_HASH
        : this.entries[this.entries.length - 1]!.payloadHash;
    const createdAt = input.createdAt ?? Date.now();
    const unsigned = {
      seq,
      prevHash,
      payloadHash: input.payloadHash,
      verdict: input.verdict,
      actorId: input.actorId,
      createdAt,
    };
    const kmsSignature = this.signer.sign(entryMessage(unsigned));
    const entry: LedgerEntry = { ...unsigned, kmsSignature };
    this.entries.push(entry);
    return entry;
  }

  /** Replay: recompute chain linkage + signature verification. */
  verifyReplay(): { ok: boolean; errors: string[] } {
    const errors: string[] = [];
    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i]!;
      const expectedPrev = i === 0 ? GENESIS_HASH : this.entries[i - 1]!.payloadHash;
      if (entry.prevHash !== expectedPrev) {
        errors.push(`seq=${entry.seq} bad prevHash`);
      }
      const { kmsSignature, ...unsigned } = entry;
      if (!this.signer.verify(entryMessage(unsigned), kmsSignature)) {
        errors.push(`seq=${entry.seq} bad signature`);
      }
      if (entry.seq !== i + 1) {
        errors.push(`seq=${entry.seq} unexpected sequence`);
      }
    }
    return { ok: errors.length === 0, errors };
  }
}

export function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** AWS/KMS helpers: import `@chaperone/ledger/kms` (keeps offline path SDK-free). */
