/**
 * Optional AWS dual-write for MCP server.
 * Enabled only when CHAPERONE_AWS=1. Failures are logged; demo stays on memory.
 */
import { awsEnabled } from "@chaperone/ledger/kms";
import {
  appendLedgerRow,
  putProposal,
  type StoredProposal,
} from "@chaperone/ledger/dynamodb";
import type { CommitResult, ProposeResult } from "@chaperone/mcp-kernel";
import { DEMO_HOUSEHOLD_META } from "@chaperone/mcp-kernel";

export function awsPersistenceActive(): boolean {
  return awsEnabled();
}

export async function persistPropose(result: ProposeResult, sessionId: string): Promise<void> {
  if (!awsEnabled()) return;
  if (!result.proposalId || !result.payloadHash || !result.payload) return;
  const row: StoredProposal = {
    id: result.proposalId,
    householdId: result.payload.householdId,
    sessionId,
    payloadHash: result.payloadHash,
    status: "open",
    policyVerdict: result.verdict,
    reasons: result.reasons,
    requiresSecondApproval: result.requiresSecondApproval,
    payloadJson: JSON.stringify(result.payload),
    createdAt: Date.now(),
    expiresAt: Date.now() + 15 * 60 * 1000,
  };
  try {
    await putProposal(row);
  } catch (err) {
    console.warn("[aws] putProposal failed (memory path unchanged):", err);
  }
}

export async function persistCommit(result: CommitResult): Promise<void> {
  if (!awsEnabled()) return;
  if (!result.ledgerEntry) return;
  try {
    await appendLedgerRow({
      householdId: DEMO_HOUSEHOLD_META.id,
      entry: result.ledgerEntry,
    });
  } catch (err) {
    console.warn("[aws] appendLedgerRow failed (memory path unchanged):", err);
  }
}
