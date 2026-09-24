import type { PolicyGrant, PolicyHousehold, PolicyMember } from "@chaperone/policy";

import type { KernelHouseholdState } from "./types-household.js";

export type DemoMemberId = "maya" | "leo" | "guest";

export interface DemoMemberProfile extends PolicyMember {
  id: DemoMemberId;
  displayName: string;
  /** Demo selector only — not biometrics / voice enrollment. */
  selectorHint: string;
}

export const DEMO_HOUSEHOLD_META = {
  id: "hh-chen",
  name: "Chen family",
  weeklyBudgetMinor: 12_000,
  spentThisWeekMinor: 3_600,
  currency: "USD" as const,
};

export const DEMO_MEMBERS: Record<DemoMemberId, DemoMemberProfile> = {
  maya: {
    id: "maya",
    displayName: "Maya",
    role: "adult",
    spendCapMinor: 3_500,
    selectorHint: "Adult · can spend within budget / soft cap",
  },
  leo: {
    id: "leo",
    displayName: "Leo",
    role: "child",
    spendCapMinor: 0,
    selectorHint: "Child · purchases denied",
  },
  guest: {
    id: "guest",
    displayName: "Guest",
    role: "guest",
    spendCapMinor: 0,
    selectorHint: "Guest · purchases denied",
  },
};

export function defaultMayaGrants(): PolicyGrant[] {
  return [
    {
      memberId: "maya",
      toolName: "propose_order",
      requiresSecondApproval: false,
      expiresAt: null,
    },
    {
      memberId: "maya",
      toolName: "commit_order",
      requiresSecondApproval: false,
      expiresAt: null,
    },
  ];
}

/** Fresh demo household state for kernels / eval (speaker selector, not biometrics). */
export function createDemoHouseholdState(): KernelHouseholdState {
  const household: PolicyHousehold = {
    id: DEMO_HOUSEHOLD_META.id,
    weeklyBudgetMinor: DEMO_HOUSEHOLD_META.weeklyBudgetMinor,
    spentThisWeekMinor: DEMO_HOUSEHOLD_META.spentThisWeekMinor,
  };
  return {
    household,
    members: [
      { id: "maya", role: "adult", spendCapMinor: 3_500 },
      { id: "leo", role: "child", spendCapMinor: 0 },
      { id: "guest", role: "guest", spendCapMinor: 0 },
    ],
    grants: defaultMayaGrants(),
  };
}

export function memberLabel(id: DemoMemberId | string | null): string {
  if (!id) return "Unknown";
  const m = DEMO_MEMBERS[id as DemoMemberId];
  return m ? `${m.displayName} (${m.role})` : id;
}
