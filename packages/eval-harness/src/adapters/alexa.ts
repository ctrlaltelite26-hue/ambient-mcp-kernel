/**
 * Alexa adapters for AmbientBench.
 * Treatment uses the real ConsentKernel. Ablation is the same kernel minus I1 hash lock.
 * Adapters never read scenario.taxonomy.
 */
import {
  ConsentKernel,
  PINNED_TOOL_CATALOG,
  createDemoHouseholdState,
  type ConsentKernelOptions,
  type OrderPayload,
} from "@chaperone/mcp-kernel";
import { lineFromSku, mockCheckout, type BasketLine } from "@chaperone/grocery-mock";

import { AlexaInputSchema, type ColumnResult, type Scenario, type SystemAdapter } from "../types.js";

function alexaInput(scenario: Scenario) {
  return AlexaInputSchema.parse(scenario.input);
}

function looksLikePurchase(utterance: string): boolean {
  return /\b(order|buy|purchase|reorder|checkout|get me|get these)\b/i.test(utterance);
}

function kidLikePhrasing(utterance: string): boolean {
  return /\b(mommy|daddy|please can i|i'?m (a )?kid|for my birthday)\b/i.test(utterance);
}

function speakerToMemberId(speaker: "adult" | "child" | "guest" | null): string | null {
  if (speaker === "adult") return "maya";
  if (speaker === "child") return "leo";
  if (speaker === "guest") return "guest";
  return null;
}

const KNOWN_SKUS = new Set([
  "coffee",
  "milk",
  "oats",
  "dish_soap",
  "candy",
  "paper_towels",
  "mixer",
  "air_fryer",
  "lawn_mower",
  "fridge",
  "vacuum",
  "drone",
  "game",
  "headphones",
  "tv",
]);

function basketForScenario(scenario: Scenario): BasketLine[] {
  const input = alexaInput(scenario);
  const item = input.context?.item;
  if (item && KNOWN_SKUS.has(item)) {
    const line = lineFromSku(item);
    if (input.context?.amountMinor !== undefined) {
      return [{ ...line, unitPriceMinor: input.context.amountMinor }];
    }
    return [line];
  }
  const amount = input.context?.amountMinor ?? 1000;
  return [{ sku: "generic", qty: 1, unitPriceMinor: amount }];
}

function seedOpenProposals(kernel: ConsentKernel, sessionId: string, count: number): void {
  for (let i = 0; i < count; i++) {
    kernel.propose({
      sessionId,
      speakerMemberId: "maya",
      intent: `reorder seed item ${i + 1}`,
      basket: [lineFromSku(i % 2 === 0 ? "coffee" : "milk")],
    });
  }
}

function runKernel(scenario: Scenario, options: ConsentKernelOptions = {}): ColumnResult {
  const input = alexaInput(scenario);
  const kernel = new ConsentKernel(createDemoHouseholdState(), undefined, undefined, options);
  const sessionId = `eval-${scenario.id}`;
  const nowMs = 1_700_000_000_000;
  const tamper = input.context?.tamperCommit;

  seedOpenProposals(kernel, sessionId, input.context?.openOrderCount ?? 0);

  const propose = kernel.propose({
    sessionId,
    speakerMemberId: speakerToMemberId(input.speaker),
    intent: input.utterance,
    basket: basketForScenario(scenario),
    nowMs,
    ttlMs: tamper === "ttl" ? 1 : undefined,
    invokedToolDescription: input.context?.invokedToolDescription,
  });

  if (propose.verdict === "deny") {
    return { verdict: "deny", executed: [], notes: propose.reasons.join("; ") };
  }

  // Never auto-commit on elicit (speaker ID or second approval).
  if (propose.verdict === "elicit") {
    return {
      verdict: "elicit",
      executed: [],
      notes: propose.reasons.join("; "),
    };
  }

  let payloadHash = propose.payloadHash!;
  let actorMemberId = "maya";
  let commitNow = nowMs;
  if (tamper === "drift") {
    payloadHash = "a".repeat(64);
  } else if (tamper === "ttl") {
    commitNow = nowMs + 60_000;
  } else if (tamper === "guest_reuse") {
    actorMemberId = "guest";
  }

  const commit = kernel.commit({
    sessionId,
    payloadHash,
    actorMemberId,
    nowMs: commitNow,
  });
  if (!commit.ok) {
    return {
      verdict: "deny",
      executed: [],
      notes: commit.reasons.join("; "),
    };
  }
  return {
    verdict: "allow",
    executed: commit.executed,
    notes: tamper ? `committed after ${tamper}` : "adult in-budget after confirm",
  };
}

/** Unguarded MCP: single place_order over the grocery mock if the utterance looks like a purchase. */
export const alexaBaseline: SystemAdapter = {
  name: "alexa-baseline-unguarded",
  run(scenario): ColumnResult {
    const input = alexaInput(scenario);
    const purchase = looksLikePurchase(input.utterance);
    const naiveKid = kidLikePhrasing(input.utterance) && input.speaker === null;
    if (!purchase && !naiveKid) {
      return {
        verdict: "allow",
        executed: [],
        notes: "unguarded: no purchase parse",
      };
    }
    try {
      mockCheckout(basketForScenario(scenario));
    } catch {
      // generic baskets still count as an executed checkout in the unguarded tool
    }
    return {
      verdict: "allow",
      executed: ["place_order"],
      notes: naiveKid ? "unguarded: kid phrasing, no speaker id" : "unguarded place_order",
    };
  },
};

/** Real kernel treatment — fresh household state per scenario (offline, no AWS). */
export const alexaTreatmentKernel: SystemAdapter = {
  name: "alexa-treatment-kernel",
  run(scenario): ColumnResult {
    return runKernel(scenario);
  },
};

/** @deprecated Use alexaTreatmentKernel */
export const alexaTreatmentStub = alexaTreatmentKernel;

/** Ablation: same kernel, I1 hash lock (and TTL freshness) off. */
export const alexaAblationNoHashLock: SystemAdapter = {
  name: "alexa-ablation-no-hash-lock",
  run(scenario): ColumnResult {
    return runKernel(scenario, { disableHashLock: true });
  },
};

/** Extra / docs only — not the printed claim column. */
export const alexaAblationPolicyOff: SystemAdapter = {
  name: "alexa-ablation-policy-off",
  run(scenario): ColumnResult {
    const input = alexaInput(scenario);
    if (!looksLikePurchase(input.utterance) && !kidLikePhrasing(input.utterance)) {
      return { verdict: "allow", executed: [], notes: "policy-off: no purchase parse" };
    }
    return {
      verdict: "allow",
      executed: ["place_order"],
      notes: "policy disabled",
    };
  },
};

/** Extra / docs only — refuse kid-like wording, still no speaker identity. */
export const alexaPromptOnlyKids: SystemAdapter = {
  name: "alexa-prompt-only-kids",
  run(scenario): ColumnResult {
    const input = alexaInput(scenario);
    if (kidLikePhrasing(input.utterance) || /\bcandy\b/i.test(input.utterance)) {
      return { verdict: "deny", executed: [], notes: "prompt-only: kid-like wording" };
    }
    return alexaBaseline.run(scenario) as ColumnResult;
  },
};

export { PINNED_TOOL_CATALOG };
export type { OrderPayload };
