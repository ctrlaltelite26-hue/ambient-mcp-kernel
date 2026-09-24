# Chaperone

Household consent kernel for ambient MCP — pantry/reorder skin for the [Amazon Developer Hackathon 2026](https://amazonappdev2026.devpost.com/) Alexa+ track.

**Model proposes · policy decides.** Irreversible tools use `propose_*` / `commit_*` with hash-locked payloads. Demo runs on a simulated Alexa+ host (no device required).

## Status

Phase 5 — AmbientBench (100 scenarios, held-out sealed) + AWS DynamoDB/KMS adapters (offline stubs default).

## Docs

- [docs/AMBIENTBENCH.md](./docs/AMBIENTBENCH.md) — claim table + seal

## Quick start

```bash
pnpm install
pnpm dev:mcp          # terminal 1 — MCP on :3333
pnpm dev:host         # terminal 2 — sim-host on :3000
```

Open [http://127.0.0.1:3000/login](http://127.0.0.1:3000/login)

**Judge password:** `household` (see `apps/sim-host/.env.example`)

Demo family: Maya (adult), Leo (child), Guest.

MCP health: [http://127.0.0.1:3333/health](http://127.0.0.1:3333/health)

### AmbientBench (offline)

```bash
pnpm eval:validate
pnpm eval:offline
```

No AWS keys required. See [docs/AMBIENTBENCH.md](./docs/AMBIENTBENCH.md).

### MCP Inspector

```bash
npx @modelcontextprotocol/inspector
```

Connect with transport **Streamable HTTP** to `http://127.0.0.1:3333/mcp`.

You should see tools `hello_chaperone`, `propose_order`, `commit_order`, `list_household` and resources `ui://chaperone/hello.html`, `ui://chaperone/confirm.html`.

## Judge access

- Sim-host: password `household` — Maya / Leo / Guest selectors (not biometrics)
- AmbientBench: `pnpm eval:offline` (no AWS)
- AWS dual-write: set `CHAPERONE_AWS=1` in `apps/mcp-server/.env` (see `.env.example`)

## Shared with Threshold

`packages/eval-harness` §7 envelope is copied into [`../threshold/packages/eval-harness`](../threshold/packages/eval-harness). Keep `ScenarioSchema` identical — see Threshold `SHARED.md`.
