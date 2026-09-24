/** Deterministic allow / elicit / deny — never LLM-gated. No ambient oracle flags. */

export type MemberRole = "owner" | "adult" | "child" | "guest";

export type PolicyVerdict = "allow" | "elicit" | "deny";

export interface PolicyMember {
  id: string;
  role: MemberRole;
  spendCapMinor: number | null;
}

export interface PolicyHousehold {
  id: string;
  weeklyBudgetMinor: number;
  spentThisWeekMinor: number;
}

export interface PolicyGrant {
  memberId: string;
  toolName: string;
  maxAmountMinor?: number;
  requiresSecondApproval: boolean;
  expiresAt: number | null;
}

/** Clock only — speaker identity and money rules live on the request, not context flags. */
export interface PolicyContext {
  nowMs?: number;
}

export interface PolicyRequest {
  household: PolicyHousehold;
  member: PolicyMember | null;
  toolName: string;
  totalMinor: number;
  grants: PolicyGrant[];
  context?: PolicyContext;
}

export interface PolicyDecision {
  verdict: PolicyVerdict;
  reasons: string[];
  /** When elicit/allow, whether commit needs a second approver. */
  requiresSecondApproval: boolean;
}

const PURCHASE_TOOLS = new Set(["propose_order", "commit_order", "place_order", "order"]);

export function evaluatePolicy(req: PolicyRequest): PolicyDecision {
  const reasons: string[] = [];
  const ctx = req.context ?? {};
  const now = ctx.nowMs ?? Date.now();

  // Unidentified speaker cannot complete an irreversible purchase (TV-ad defense).
  if (req.member === null) {
    return {
      verdict: "elicit",
      reasons: ["identify speaker — select maya, leo, or guest"],
      requiresSecondApproval: false,
    };
  }

  if (req.member.role === "guest") {
    return {
      verdict: "deny",
      reasons: ["guest cannot purchase"],
      requiresSecondApproval: false,
    };
  }

  if (!PURCHASE_TOOLS.has(req.toolName)) {
    return {
      verdict: "allow",
      reasons: ["non-purchase tool"],
      requiresSecondApproval: false,
    };
  }

  const remaining = req.household.weeklyBudgetMinor - req.household.spentThisWeekMinor;
  if (req.totalMinor > remaining) {
    reasons.push("over weekly household budget");
    return { verdict: "deny", reasons, requiresSecondApproval: false };
  }

  // Kids can ask; they cannot spend. Hold a hash-locked proposal for an adult.
  if (req.member.role === "child") {
    return {
      verdict: "elicit",
      reasons: ["child cannot purchase — waiting on an adult"],
      requiresSecondApproval: true,
    };
  }

  const grant = req.grants.find(
    (g) =>
      g.memberId === req.member!.id &&
      g.toolName === req.toolName &&
      (g.expiresAt === null || g.expiresAt > now),
  );

  const softCap = req.member.spendCapMinor;
  const overSoftCap =
    softCap !== null && softCap !== undefined && req.totalMinor > softCap;

  const needsSecond =
    grant?.requiresSecondApproval === true ||
    overSoftCap ||
    (grant?.maxAmountMinor !== undefined && req.totalMinor > grant.maxAmountMinor);

  if (needsSecond) {
    if (overSoftCap) reasons.push("over member spend cap — needs confirmation");
    if (grant?.requiresSecondApproval) reasons.push("grant requires second approval");
    if (grant?.maxAmountMinor !== undefined && req.totalMinor > grant.maxAmountMinor) {
      reasons.push("over grant max amount");
    }
    return {
      verdict: "elicit",
      reasons: reasons.length ? reasons : ["needs confirmation"],
      requiresSecondApproval: true,
    };
  }

  return {
    verdict: "allow",
    reasons: ["adult in-budget"],
    requiresSecondApproval: false,
  };
}
