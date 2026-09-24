import { describe, expect, it } from "vitest";

import { evaluatePolicy, type PolicyRequest } from "./index.js";

const household = {
  id: "hh-chen",
  weeklyBudgetMinor: 12000,
  spentThisWeekMinor: 3600,
};

const adult = { id: "maya", role: "adult" as const, spendCapMinor: 3500 };
const child = { id: "leo", role: "child" as const, spendCapMinor: 0 };
const guest = { id: "guest", role: "guest" as const, spendCapMinor: 0 };

function base(partial: Partial<PolicyRequest> & Pick<PolicyRequest, "member" | "totalMinor">): PolicyRequest {
  return {
    household,
    toolName: "propose_order",
    grants: [],
    ...partial,
  };
}

describe("evaluatePolicy", () => {
  it("holds child purchases for an adult; guests stay denied", () => {
    const kid = evaluatePolicy(base({ member: child, totalMinor: 499 }));
    expect(kid.verdict).toBe("elicit");
    expect(kid.requiresSecondApproval).toBe(true);
    expect(kid.reasons.join(" ")).toMatch(/waiting on an adult/i);

    expect(evaluatePolicy(base({ member: guest, totalMinor: 1400 })).verdict).toBe("deny");
  });

  it("still denies a child purchase over weekly household budget", () => {
    const d = evaluatePolicy(base({ member: child, totalMinor: 9000 }));
    expect(d.verdict).toBe("deny");
    expect(d.requiresSecondApproval).toBe(false);
  });

  it("elicits when speaker is missing (TV ad / ambient unidentified)", () => {
    const d = evaluatePolicy(base({ member: null, totalMinor: 129900 }));
    expect(d.verdict).toBe("elicit");
    expect(d.reasons.join(" ")).toMatch(/identify speaker/i);
  });

  it("does not read ambient oracle flags (tvPlaying etc. are not on PolicyContext)", () => {
    const d = evaluatePolicy(base({ member: adult, totalMinor: 1400 }));
    expect(d.verdict).toBe("allow");
  });

  it("allows adult in-budget under soft cap", () => {
    const d = evaluatePolicy(base({ member: adult, totalMinor: 1400 }));
    expect(d.verdict).toBe("allow");
  });

  it("elicits when over soft cap", () => {
    const d = evaluatePolicy(base({ member: adult, totalMinor: 5000 }));
    expect(d.verdict).toBe("elicit");
    expect(d.requiresSecondApproval).toBe(true);
  });

  it("denies when over weekly budget", () => {
    const d = evaluatePolicy(base({ member: adult, totalMinor: 9000 }));
    expect(d.verdict).toBe("deny");
  });
});
