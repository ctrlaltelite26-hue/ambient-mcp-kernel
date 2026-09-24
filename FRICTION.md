# Friction log

Continuous log for the Amazon Developer Hackathon (up to +10% judging bonus).  
Template fields: **task**, **steps**, **expected**, **actual**, **severity**, **workaround**, **suggestion**.

Severity: `blocker` | `high` | `medium` | `low` | `nit`

---

## 2026-09-19 — Phase 0 scaffold / MCP Apps + SDK pairing

| Field | Entry |
|-------|--------|
| **Task** | Scaffold `apps/mcp-server` hello Streamable HTTP + `ui://` via `@modelcontextprotocol/ext-apps` |
| **Steps** | 1) Create pnpm workspace 2) Add `@modelcontextprotocol/sdk` + `ext-apps` 3) `registerAppTool` / `registerAppResource` 4) `pnpm install` + `pnpm dev:mcp` |
| **Expected** | Packages install cleanly; Inspector lists `hello_chaperone` and reads `ui://chaperone/hello.html` |
| **Actual** | Pass (2026-09-19). `pnpm install` OK; server on `127.0.0.1:3333`; initialize negotiates `2025-11-25`; `tools/list` shows `hello_chaperone` with `_meta.ui.resourceUri`; `resources/read` returns `text/html;profile=mcp-app` HTML |
| **Severity** | low (resolved) |
| **Workaround** | n/a |
| **Suggestion** | Publish a one-page “hello Streamable HTTP + MCP App” sample aimed at Alexa+ hackathon builders |

---

## 2026-09-19 — Phase 1 eval harness / corpus freeze

| Field | Entry |
|-------|--------|
| **Task** | Build `@chaperone/eval-harness` + seed 20 AmbientBench scenarios; `pnpm eval:offline` |
| **Steps** | Schema+loader, runner columns, alexa stub adapters, corpus JSON, vitest invalid fixture |
| **Expected** | Validate + offline claim table; treatment bypasses = 0 on seed set |
| **Actual** | Pass (2026-09-19). 20/20 treatmentPass; baseline bypasses=16; treatment=0; ablation=16; falseRefusals=0 |
| **Severity** | low (resolved) |
| **Workaround** | n/a — Phase 2 swaps `alexaTreatmentStub` for real kernel |
| **Suggestion** | Document stub→kernel handoff in AMBIENTBENCH.md so judges don't think eval is the product |

---

## 2026-09-19 — Phase 2 protocol core

| Field | Entry |
|-------|--------|
| **Task** | Ship policy + mcp-kernel propose/commit + ledger + I1–I3; wire MCP tools + AmbientBench treatment |
| **Steps** | Packages policy/ledger/grocery-mock/mcp-kernel; invariant vitests; mcp-server tools; eval adapter swap |
| **Expected** | All package tests green; `pnpm eval:offline` 20/20 with treatment=kernel; bypasses treatment=0 |
| **Actual** | Pass (2026-09-19). I1–I3 green; AmbientBench 20/20; baseline bypasses=16 treatment=0 ablation=16 |
| **Severity** | low (resolved) |
| **Workaround** | n/a |
| **Suggestion** | Keep confirm MCP App as stub until Phase 3; document that elicit does not auto-commit in eval |

---

## 2026-09-19 — Phase 3 product skin + MCP Apps

| Field | Entry |
|-------|--------|
| **Task** | Confirm MCP App (screen D), grocery cart, household seed, speaker elicitation, cross-session grants |
| **Steps** | grocery-mock Cart; seed Maya/Leo/Guest; confirm.html + confirmView; policy null→elicit; grant upsert tests |
| **Expected** | Tests + AmbientBench 20/20; confirm view shows basket/spender/budget/blast/hash |
| **Actual** | Pass (2026-09-19). Phase3 tests green; ambient-008 now elicit (identify speaker); treatment bypasses=0 |
| **Severity** | low (resolved) |
| **Workaround** | n/a |
| **Suggestion** | Phase 4 sim-host should postMessage confirmView into iframe for hosts without full MCP Apps |

---

## 2026-09-19 — Phase 4 simulated Alexa+ host

| Field | Entry |
|-------|--------|
| **Task** | Next.js sim-host: login, Streamable HTTP propose/commit, confirm iframe, TV-ad, deny/receipt |
| **Steps** | Scaffold apps/sim-host; API routes proxy MCP client; HostApp states A/B/C/E/F |
| **Expected** | Judge can log in at :3000, run propose/commit against :3333 MCP, TV-ad split works |
| **Actual** | Pass scaffold + typecheck (2026-09-19). Creds: password `household` |
| **Severity** | low |
| **Workaround** | Keep MCP running (`pnpm dev:mcp`) while using sim-host |
| **Suggestion** | Document dual-terminal start in README for judges |

---

## 2026-09-19 — Phase 5 AmbientBench + AWS adapters

| Field | Entry |
|-------|--------|
| **Task** | Expand corpus to 100, seal held-out, claim table, DynamoDB+KMS dual-write, Devpost draft |
| **Steps** | Corpus+seal; `pnpm eval:offline`; `@chaperone/ledger` kms/dynamodb/bedrock; mcp-server `aws-persist`; docs |
| **Expected** | 100/100 treatmentPass; treatment bypasses=0; AWS optional via `CHAPERONE_AWS=1`; offline never requires keys |
| **Actual** | Pass (2026-09-19). 100/100 treatmentPass; bypasses baseline=86 treatment=0 ablation=86; falseRefusals=0; seal `9bd59aea…`; Bedrock stub only |
| **Severity** | low |
| **Workaround** | Keep `CHAPERONE_AWS` unset for demo; dual-write failures log and leave memory path intact |
| **Suggestion** | Ship a one-click “create chaperone DynamoDB tables + KMS alias” CloudFormation sample for Builder mini |

---

## 2026-09-20 — Honest AmbientBench (strip oracles)

| Field | Entry |
|-------|--------|
| **Task** | Remove `tvPlaying` / `injectedToolDescription` / `ambiguousIntent` oracles; measure identity, catalog hash, referents, hash-lock |
| **Steps** | Policy+MCP+host strip flags; kernel pin + `disableHashLock` + open-proposal referents; rewrite baseline/ablation; rewrite corpus + I1 class; `pnpm test`; `pnpm eval:offline`; re-seal held-out |
| **Expected** | Treatment bypasses 0; baseline ≠ ablation; false refusals published; no retune toward 100/100 |
| **Actual** | Pass (2026-09-20). treatmentPass 100/100 against mechanism labels; bypasses baseline=81 treatment=0 ablation=10; falseRefusals=0; seal `8ca0f8bd…`. Ablation is hash-lock off, not unguarded MCP. TV-ad path is unidentified speaker → elicit, not a TV detector. |
| **Severity** | high (integrity of the claim table) |
| **Workaround** | Demo copy: unidentified speaker cannot commit. Host must pass `invokedToolDescription` for catalog pin. |
| **Suggestion** | Keep held-out sealed; do not add oracle flags if a new attack class scores poorly |

---
