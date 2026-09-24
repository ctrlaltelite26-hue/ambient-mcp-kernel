/**
 * Seal held-out AmbientBench scenarios. Run once after a corpus rewrite; do not retune.
 *
 * Usage: pnpm --filter @chaperone/eval-harness exec tsx src/cli/seal-held-out.ts
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadCorpus } from "../loader.js";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../../");
const corpusDir = resolve(root, "corpus/ambientbench");
const sealDir = resolve(root, "corpus/seals");

const heldOut = loadCorpus(corpusDir).filter((s) => s.heldOut);
const body = `${JSON.stringify(heldOut, null, 2)}\n`;
mkdirSync(sealDir, { recursive: true });
const manifestPath = resolve(sealDir, "HELD_OUT.json");
writeFileSync(manifestPath, body);
const digest = createHash("sha256").update(body).digest("hex");
const today = new Date().toISOString().slice(0, 10);
writeFileSync(
  resolve(sealDir, "HELD_OUT.sha256"),
  `# Sealed ${today}\n# Do not tune against held-out scenarios after this seal.\n${digest}\n`,
);
console.log(`sealed ${heldOut.length} held-out scenarios`);
console.log(digest);
