import { createHash, randomUUID } from "node:crypto";

import { AppendOnlyLedger, type LedgerEntry } from "@chaperone/ledger";
import {
  evaluatePolicy,
  type PolicyContext,
  type PolicyDecision,
  type PolicyGrant,
  type PolicyHousehold,
  type PolicyMember,
} from "@chaperone/policy";
import { basketTotalMinor, mockCheckout, type BasketLine } from "@chaperone/grocery-mock";
import { buildConfirmView, type ConfirmViewModel } from "./confirm-view.js";
import { createDemoHouseholdState } from "./seed.js";
import type { KernelHouseholdState } from "./types-household.js";

export type { KernelHouseholdState } from "./types-household.js";
export { buildConfirmView, type ConfirmViewModel } from "./confirm-view.js";
export {
  createDemoHouseholdState,
  DEMO_HOUSEHOLD_META,
  DEMO_MEMBERS,
  defaultMayaGrants,
  memberLabel,
  type DemoMemberId,
  type DemoMemberProfile,
} from "./seed.js";

/**
 * Canonical JSON for hashing (I1).
 * - Recursively sort object keys
 * - No insignificant whitespace
 * - Integers only for money fields (callers must not pass floats)
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortValue);
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    out[key] = sortValue(obj[key]);
  }
  return out;
}

export function sha256Canonical(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

export interface OrderPayload {
  householdId: string;
  speakerMemberId: string | null;
  intent: string;
  currency: "USD";
  basket: BasketLine[];
  totalMinor: number;
}

export type ProposalStatus = "open" | "committed" | "expired" | "denied";

export interface Proposal {
  id: string;
  householdId: string;
  sessionId: string;
  payload: OrderPayload;
  payloadHash: string;
  status: ProposalStatus;
  policyVerdict: PolicyDecision["verdict"];
  reasons: string[];
  requiresSecondApproval: boolean;
  createdAt: number;
  expiresAt: number;
}

/** Pinned tool catalog — hashed at list time; mutated descriptions fail at invoke. */
export const PINNED_TOOL_CATALOG = {
  propose_order:
    "Propose a grocery order. Returns policy verdict + optional confirm MCP App. Does not charge.",
  commit_order: "Commit a prior propose_order by exact payload hash.",
  list_household: "Demo Chen family members and grants (selector roles, not voice ID).",
} as const;

export function pinnedCatalogHash(): string {
  return sha256Canonical(PINNED_TOOL_CATALOG);
}

export function hashToolDescription(description: string): string {
  return sha256Canonical(description);
}

export interface ConsentKernelOptions {
  /** Ablation: skip I1 hash recompute and resolve commit by latest open proposal. */
  disableHashLock?: boolean;
}

export interface ProposeInput {
  sessionId: string;
  speakerMemberId: string | null;
  intent: string;
  basket: BasketLine[];
  context?: PolicyContext;
  nowMs?: number;
  /** Proposal TTL ms — default 15 minutes */
  ttlMs?: number;
  /**
   * Description the host claims it listed for propose_order.
   * If set and hash ≠ pinned catalog, deny (structural prompt injection).
   */
  invokedToolDescription?: string;
}

export interface ProposeResult {
  verdict: PolicyDecision["verdict"];
  reasons: string[];
  requiresSecondApproval: boolean;
  /** speaker = identify member; confirm = hash-locked approval card */
  elicitKind?: "speaker" | "confirm";
  proposalId?: string;
  payloadHash?: string;
  payload?: OrderPayload;
  uiResourceUri?: string;
  confirmView?: ConfirmViewModel;
}

export interface CommitInput {
  sessionId: string;
  payloadHash: string;
  /** Approver; defaults to original speaker when policy allows self-confirm */
  actorMemberId?: string;
  nowMs?: number;
}

export interface CommitResult {
  ok: boolean;
  reasons: string[];
  ledgerEntry?: LedgerEntry;
  receiptId?: string;
  executed: string[];
}

export interface ProposalStore {
  put(proposal: Proposal): void;
  getByHash(householdId: string, sessionId: string, hash: string): Proposal | undefined;
  update(proposal: Proposal): void;
  listOpen(sessionId: string): Proposal[];
}

export class MemoryProposalStore implements ProposalStore {
  private byKey = new Map<string, Proposal>();

  private key(householdId: string, sessionId: string, hash: string) {
    return `${householdId}::${sessionId}::${hash}`;
  }

  put(proposal: Proposal): void {
    this.byKey.set(this.key(proposal.householdId, proposal.sessionId, proposal.payloadHash), proposal);
  }

  getByHash(householdId: string, sessionId: string, hash: string): Proposal | undefined {
    return this.byKey.get(this.key(householdId, sessionId, hash));
  }

  update(proposal: Proposal): void {
    this.put(proposal);
  }

  listOpen(sessionId: string): Proposal[] {
    return [...this.byKey.values()].filter(
      (p) => p.sessionId === sessionId && p.status === "open",
    );
  }
}

const CANCEL_RE =
  /\b(cancel( it)?|never mind|forget it|stop that|undo( that)?)\b/i;
const VAGUE_RE =
  /\b(the thing we talked about|do the usual|yes that one|finish what i started|that one|the usual|the thing)\b/i;

export function isVagueOrCancelIntent(intent: string): boolean {
  return CANCEL_RE.test(intent) || VAGUE_RE.test(intent);
}

const CONFIRM_UI = "ui://chaperone/confirm.html";

export class ConsentKernel {
  constructor(
    private readonly state: KernelHouseholdState,
    private readonly proposals: ProposalStore = new MemoryProposalStore(),
    private readonly ledger: AppendOnlyLedger = new AppendOnlyLedger(),
    private readonly options: ConsentKernelOptions = {},
  ) {}

  getLedger(): AppendOnlyLedger {
    return this.ledger;
  }

  propose(input: ProposeInput): ProposeResult {
    const now = input.nowMs ?? Date.now();
    const member =
      input.speakerMemberId === null
        ? null
        : (this.state.members.find((m) => m.id === input.speakerMemberId) ?? null);

    if (
      input.invokedToolDescription !== undefined &&
      hashToolDescription(input.invokedToolDescription) !==
        hashToolDescription(PINNED_TOOL_CATALOG.propose_order)
    ) {
      return {
        verdict: "deny",
        reasons: ["tool description hash mismatch — mutated catalog"],
        requiresSecondApproval: false,
      };
    }

    if (isVagueOrCancelIntent(input.intent)) {
      const open = this.proposals.listOpen(input.sessionId);
      if (open.length === 0) {
        return {
          verdict: "deny",
          reasons: ["unresolved referent — no open order"],
          requiresSecondApproval: false,
        };
      }
      if (open.length !== 1) {
        return {
          verdict: "elicit",
          reasons: ["unresolved referent — which order?"],
          requiresSecondApproval: false,
          elicitKind: "confirm",
        };
      }
      const unique = open[0];
      if (!unique) {
        return {
          verdict: "deny",
          reasons: ["unresolved referent — no open order"],
          requiresSecondApproval: false,
        };
      }
      if (CANCEL_RE.test(input.intent)) {
        unique.status = "denied";
        this.proposals.update(unique);
        return {
          verdict: "allow",
          reasons: ["cancelled unique open order"],
          requiresSecondApproval: false,
        };
      }
      return {
        verdict: "elicit",
        reasons: ["unresolved referent — confirm unique open order"],
        requiresSecondApproval: false,
        elicitKind: "confirm",
      };
    }

    const totalMinor = basketTotalMinor(input.basket);
    const payload: OrderPayload = {
      householdId: this.state.household.id,
      speakerMemberId: input.speakerMemberId,
      intent: input.intent,
      currency: "USD",
      basket: input.basket.map((l) => ({
        sku: l.sku,
        qty: l.qty,
        unitPriceMinor: l.unitPriceMinor,
      })),
      totalMinor,
    };

    const decision = evaluatePolicy({
      household: this.state.household,
      member,
      toolName: "propose_order",
      totalMinor,
      grants: this.state.grants,
      context: input.context,
    });

    // I2: ledger verdict never written by a model — only policy/code paths below.
    if (decision.verdict === "deny") {
      return {
        verdict: "deny",
        reasons: decision.reasons,
        requiresSecondApproval: false,
      };
    }

    // In-protocol speaker elicitation — no hash until host re-proposes with speakerMemberId.
    if (decision.verdict === "elicit" && member === null) {
      return {
        verdict: "elicit",
        reasons: decision.reasons,
        requiresSecondApproval: false,
        elicitKind: "speaker",
      };
    }

    const payloadHash = sha256Canonical(payload);
    const proposal: Proposal = {
      id: randomUUID(),
      householdId: this.state.household.id,
      sessionId: input.sessionId,
      payload,
      payloadHash,
      status: "open",
      policyVerdict: decision.verdict,
      reasons: decision.reasons,
      requiresSecondApproval: decision.requiresSecondApproval,
      createdAt: now,
      expiresAt: now + (input.ttlMs ?? 15 * 60 * 1000),
    };
    this.proposals.put(proposal);

    const confirmView = buildConfirmView({
      payload,
      payloadHash,
      sessionId: input.sessionId,
      member,
      weeklyBudgetMinor: this.state.household.weeklyBudgetMinor,
      spentThisWeekMinor: this.state.household.spentThisWeekMinor,
      requiresSecondApproval: decision.requiresSecondApproval,
      reasons: decision.reasons,
    });

    return {
      verdict: decision.verdict,
      reasons: decision.reasons,
      requiresSecondApproval: decision.requiresSecondApproval,
      elicitKind: decision.verdict === "elicit" ? "confirm" : undefined,
      proposalId: proposal.id,
      payloadHash,
      payload,
      uiResourceUri: CONFIRM_UI,
      confirmView,
    };
  }

  /** Household grant table — shared across host sessions. */
  listGrants(): readonly PolicyGrant[] {
    return this.state.grants;
  }

  upsertGrant(grant: PolicyGrant): void {
    const idx = this.state.grants.findIndex(
      (g) => g.memberId === grant.memberId && g.toolName === grant.toolName,
    );
    if (idx >= 0) this.state.grants[idx] = grant;
    else this.state.grants.push(grant);
  }

  revokeGrant(memberId: string, toolName: string): void {
    this.state.grants = this.state.grants.filter(
      (g) => !(g.memberId === memberId && g.toolName === toolName),
    );
  }

  getHouseholdState(): KernelHouseholdState {
    return this.state;
  }

  commit(input: CommitInput): CommitResult {
    const now = input.nowMs ?? Date.now();
    let proposal = this.proposals.getByHash(
      this.state.household.id,
      input.sessionId,
      input.payloadHash,
    );

    if (!proposal && this.options.disableHashLock) {
      const open = this.proposals.listOpen(input.sessionId);
      proposal = open.sort((a, b) => b.createdAt - a.createdAt)[0];
    }

    if (!proposal) {
      return { ok: false, reasons: ["unknown proposal hash"], executed: [] };
    }
    if (proposal.status !== "open") {
      return { ok: false, reasons: [`proposal ${proposal.status}`], executed: [] };
    }
    if (now > proposal.expiresAt) {
      if (!this.options.disableHashLock) {
        proposal.status = "expired";
        this.proposals.update(proposal);
        return { ok: false, reasons: ["proposal expired"], executed: [] };
      }
    }

    // I1: commit only if hash matches canonical payload (reject byte drift).
    if (!this.options.disableHashLock) {
      const recomputed = sha256Canonical(proposal.payload);
      if (recomputed !== input.payloadHash || recomputed !== proposal.payloadHash) {
        return { ok: false, reasons: ["payload hash mismatch"], executed: [] };
      }
    }

    const actorId = input.actorMemberId ?? proposal.payload.speakerMemberId;
    const member =
      actorId === null ? null : (this.state.members.find((m) => m.id === actorId) ?? null);

    const decision = evaluatePolicy({
      household: this.state.household,
      member,
      toolName: "commit_order",
      totalMinor: proposal.payload.totalMinor,
      grants: this.state.grants,
      context: {},
    });

    if (decision.verdict === "deny") {
      return { ok: false, reasons: decision.reasons, executed: [] };
    }

    // Elicit at commit time still blocks auto-execute without an adult actor.
    if (decision.verdict === "elicit" && member?.role !== "adult" && member?.role !== "owner") {
      return {
        ok: false,
        reasons: ["second approval required from adult"],
        executed: [],
      };
    }

    const checkout = mockCheckout(proposal.payload.basket);
    const ledgerEntry = this.ledger.append({
      payloadHash: proposal.payloadHash,
      verdict: "allow",
      actorId: actorId ?? "unknown",
      createdAt: now,
    });

    proposal.status = "committed";
    this.proposals.update(proposal);
    this.state.household.spentThisWeekMinor += proposal.payload.totalMinor;

    return {
      ok: true,
      reasons: ["committed"],
      ledgerEntry,
      receiptId: checkout.receiptId,
      executed: ["commit_order"],
    };
  }
}
