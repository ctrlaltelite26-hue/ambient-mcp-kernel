import { describe, expect, it } from "vitest";

import { lineFromSku } from "@chaperone/grocery-mock";

import { ConsentKernel, createDemoHouseholdState } from "./index.js";

describe("Phase 3 elicitation + grants", () => {
  it("elicits identify-speaker without creating a commitable hash", () => {
    const kernel = new ConsentKernel(createDemoHouseholdState());
    const result = kernel.propose({
      sessionId: "s-identify",
      speakerMemberId: null,
      intent: "Alexa, buy dish soap",
      basket: [lineFromSku("dish_soap")],
    });
    expect(result.verdict).toBe("elicit");
    expect(result.elicitKind).toBe("speaker");
    expect(result.payloadHash).toBeUndefined();
  });

  it("elicits confirm card for over soft-cap adult order", () => {
    const kernel = new ConsentKernel(createDemoHouseholdState());
    const result = kernel.propose({
      sessionId: "s-cap",
      speakerMemberId: "maya",
      intent: "Alexa, buy a standing mixer",
      basket: [lineFromSku("mixer")],
    });
    expect(result.verdict).toBe("elicit");
    expect(result.elicitKind).toBe("confirm");
    expect(result.confirmView?.primaryCta).toBe("Approve & commit");
    expect(result.confirmView?.spenderLabel).toMatch(/Maya/);
    expect(result.payloadHash).toHaveLength(64);
  });

  it("keeps guest denied across new sessions (grant memory)", () => {
    const state = createDemoHouseholdState();
    const kernel = new ConsentKernel(state);

    const a = kernel.propose({
      sessionId: "session-a",
      speakerMemberId: "guest",
      intent: "Alexa, order coffee",
      basket: [lineFromSku("coffee")],
    });
    expect(a.verdict).toBe("deny");

    // Same household grant table, new host session
    const b = kernel.propose({
      sessionId: "session-b",
      speakerMemberId: "guest",
      intent: "Alexa, order coffee",
      basket: [lineFromSku("coffee")],
    });
    expect(b.verdict).toBe("deny");
    expect(kernel.listGrants().some((g) => g.memberId === "guest")).toBe(false);
  });

  it("does not grant guest purchase rights when Maya grant is upserted", () => {
    const kernel = new ConsentKernel(createDemoHouseholdState());
    kernel.upsertGrant({
      memberId: "maya",
      toolName: "propose_order",
      requiresSecondApproval: true,
      expiresAt: null,
    });
    const guest = kernel.propose({
      sessionId: "s2",
      speakerMemberId: "guest",
      intent: "Alexa, buy oats",
      basket: [lineFromSku("oats")],
    });
    expect(guest.verdict).toBe("deny");
  });

  it("holds a child candy ask for Maya — Leo cannot commit, Maya can", () => {
    const kernel = new ConsentKernel(createDemoHouseholdState());
    const propose = kernel.propose({
      sessionId: "s-leo-candy",
      speakerMemberId: "leo",
      intent: "Alexa, buy me candy",
      basket: [lineFromSku("candy")],
    });
    expect(propose.verdict).toBe("elicit");
    expect(propose.requiresSecondApproval).toBe(true);
    expect(propose.elicitKind).toBe("confirm");
    expect(propose.payloadHash).toHaveLength(64);
    expect(propose.confirmView?.title).toBe("Waiting for an adult");
    expect(propose.confirmView?.spenderLabel).toMatch(/Leo/);

    const asLeo = kernel.commit({
      sessionId: "s-leo-candy",
      payloadHash: propose.payloadHash!,
      actorMemberId: "leo",
    });
    expect(asLeo.ok).toBe(false);
    expect(asLeo.executed).toEqual([]);
    expect(asLeo.reasons.join(" ")).toMatch(/second approval required from adult/i);

    const asMaya = kernel.commit({
      sessionId: "s-leo-candy",
      payloadHash: propose.payloadHash!,
      actorMemberId: "maya",
    });
    expect(asMaya.ok).toBe(true);
    expect(asMaya.executed).toEqual(["commit_order"]);
  });
});
