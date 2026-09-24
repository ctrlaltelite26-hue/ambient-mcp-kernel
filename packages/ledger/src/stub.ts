import { createHmac } from "node:crypto";

export interface LedgerSigner {
  sign(message: string): string;
  verify(message: string, signature: string): boolean;
  readonly mode: "stub" | "kms";
}

/** Offline stub — HMAC with fixed demo key. */
export function createStubSigner(secret = "chaperone-offline-stub-key"): LedgerSigner {
  return {
    mode: "stub",
    sign(message: string) {
      return createHmac("sha256", secret).update(message, "utf8").digest("hex");
    },
    verify(message: string, signature: string) {
      return this.sign(message) === signature;
    },
  };
}
