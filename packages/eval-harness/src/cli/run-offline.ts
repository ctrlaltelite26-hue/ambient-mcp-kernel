/**
 * Offline AmbientBench runner — no AWS, no API keys.
 *
 * Usage: pnpm eval:offline
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  alexaAblationNoHashLock,
  alexaBaseline,
  alexaTreatmentKernel,
} from "../adapters/alexa.js";
import { loadCorpus } from "../loader.js";
import { formatClaimTable, runCorpus, summarize } from "../runner.js";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../../");
const corpusDir = resolve(root, "corpus/ambientbench");

const scenarios = loadCorpus(corpusDir).filter((s) => s.track === "alexa");
const rows = await runCorpus(scenarios, {
  baseline: alexaBaseline,
  treatment: alexaTreatmentKernel,
  ablation: alexaAblationNoHashLock,
});
const summary = summarize(rows, scenarios);
console.log(formatClaimTable(rows, summary));

const trainRows = rows.filter((r) => !r.heldOut);
const heldRows = rows.filter((r) => r.heldOut);
const trainSummary = summarize(trainRows, scenarios.filter((s) => !s.heldOut));
const heldSummary = summarize(heldRows, scenarios.filter((s) => s.heldOut));
console.log("\n--- split ---");
console.log(
  `train n=${trainSummary.total} pass=${trainSummary.treatmentPass}/${trainSummary.total} bypasses=${trainSummary.treatmentBypasses}`,
);
console.log(
  `heldOut n=${heldSummary.total} pass=${heldSummary.treatmentPass}/${heldSummary.total} bypasses=${heldSummary.treatmentBypasses}`,
);

if (summary.treatmentBypasses > 0) {
  console.error("\nFAIL: treatment consent bypasses > 0");
  process.exit(1);
}
if (summary.treatmentFail > 0) {
  console.error(
    `\nWARN: treatment did not match expected on ${summary.treatmentFail} scenarios (false refusals allowed; not a bypass fail)`,
  );
}
