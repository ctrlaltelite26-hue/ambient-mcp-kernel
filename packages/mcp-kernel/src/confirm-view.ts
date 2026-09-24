import {
  formatBasketLine,
  formatMoneyMinor,
  type BasketLine,
} from "@chaperone/grocery-mock";
import type { PolicyMember } from "@chaperone/policy";

import { DEMO_MEMBERS, type DemoMemberId } from "./seed.js";

export interface ConfirmOrderPayload {
  householdId: string;
  speakerMemberId: string | null;
  intent: string;
  currency: "USD";
  basket: BasketLine[];
  totalMinor: number;
}

export interface ConfirmViewModel {
  title: string;
  subtitle: string;
  basketLines: string[];
  spenderLabel: string;
  budgetLeftAfterLabel: string;
  budgetLeftAfterMinor: number;
  blastRadius: string;
  payloadHash: string;
  payloadHashShort: string;
  sessionId: string;
  primaryCta: string;
  secondaryCta: string;
  tertiaryCta: string;
  footer: string;
  requiresSecondApproval: boolean;
  reasons: string[];
}

export function buildConfirmView(input: {
  payload: ConfirmOrderPayload;
  payloadHash: string;
  sessionId: string;
  member: PolicyMember | null;
  weeklyBudgetMinor: number;
  spentThisWeekMinor: number;
  requiresSecondApproval: boolean;
  reasons: string[];
}): ConfirmViewModel {
  const leftAfter =
    input.weeklyBudgetMinor - input.spentThisWeekMinor - input.payload.totalMinor;
  const spender = labelForMember(input.payload.speakerMemberId, input.member);
  const childHold = input.requiresSecondApproval && input.member?.role === "child";
  return {
    title: childHold ? "Waiting for an adult" : "Confirm order",
    subtitle: childHold
      ? `${firstName(spender)} asked · waiting on an adult`
      : "Chaperone · hash-locked proposal",
    basketLines: input.payload.basket.map((line) => formatBasketLine(line)),
    spenderLabel: spender,
    budgetLeftAfterLabel: formatMoneyMinor(leftAfter),
    budgetLeftAfterMinor: leftAfter,
    blastRadius: "Charges household card · irreversible",
    payloadHash: input.payloadHash,
    payloadHashShort: `${input.payloadHash.slice(0, 12)}…${input.payloadHash.slice(-8)}`,
    sessionId: input.sessionId,
    primaryCta: "Approve & commit",
    secondaryCta: "Deny",
    tertiaryCta: "Switch approver",
    footer: "Model proposes · policy decides",
    requiresSecondApproval: input.requiresSecondApproval,
    reasons: input.reasons,
  };
}

function labelForMember(
  speakerMemberId: string | null,
  member: PolicyMember | null,
): string {
  if (!speakerMemberId || !member) return "Unknown speaker";
  const demo = DEMO_MEMBERS[speakerMemberId as DemoMemberId];
  if (demo) return `${demo.displayName} (${demo.role})`;
  return `${member.id} (${member.role})`;
}

function firstName(spenderLabel: string): string {
  const name = spenderLabel.split(" ")[0];
  return name && name !== "Unknown" ? name : "Someone";
}
