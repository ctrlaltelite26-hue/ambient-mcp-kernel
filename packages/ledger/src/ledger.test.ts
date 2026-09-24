import { describe, expect, it } from "vitest";

import { AppendOnlyLedger, createStubSigner } from "./index.js";

describe("AppendOnlyLedger", () => {
  it("appends signed rows and replays cleanly", () => {
    const ledger = new AppendOnlyLedger(createStubSigner());
    ledger.append({ payloadHash: "a".repeat(64), verdict: "allow", actorId: "maya" });
    ledger.append({ payloadHash: "b".repeat(64), verdict: "allow", actorId: "maya" });
    expect(ledger.verifyReplay()).toEqual({ ok: true, errors: [] });
  });

  it("detects tampered signature", () => {
    const ledger = new AppendOnlyLedger(createStubSigner());
    ledger.append({ payloadHash: "a".repeat(64), verdict: "allow", actorId: "maya" });
    (ledger.list() as { kmsSignature: string }[])[0]!.kmsSignature = "deadbeef";
    expect(ledger.verifyReplay().ok).toBe(false);
  });
});
