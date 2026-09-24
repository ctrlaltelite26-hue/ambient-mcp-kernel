# Invariants

Offline, no AWS. Run:

```bash
pnpm --filter @chaperone/mcp-kernel test
pnpm eval:offline
```

## I1 — Hash-locked commit

`commit_order` executes **if and only if**:

1. A prior `propose_order` stored an open proposal for the same `sessionId` + `householdId`
2. `sha256(canonicalJson(payload))` equals the hash passed to commit
3. Proposal is not expired
4. Policy still allows the actor to commit

Byte drift (any payload mutation) must fail commit.

## I2 — Model never writes ledger verdicts

Only `ConsentKernel` + `evaluatePolicy` decide allow/elicit/deny and append ledger rows. No LLM in the path.

## I3 — Append-only signed ledger

Each row links `prevHash` → prior `payloadHash` (genesis = 64 zero hex). Offline stub HMAC signer verifies on `verifyReplay()`. Phase 5 may swap in KMS; replay must still pass.

## Canonical JSON

- Recursive key sort
- Compact `JSON.stringify`
- Money as integer **minor units** only (no floats)
