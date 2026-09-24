import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadCorpus, ScenarioLoadError } from "../loader.js";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../../");
const corpusDir = resolve(root, "corpus/ambientbench");

try {
  const scenarios = loadCorpus(corpusDir);
  console.log(`OK: ${scenarios.length} scenarios validated in ${corpusDir}`);
  process.exit(0);
} catch (err) {
  if (err instanceof ScenarioLoadError) {
    console.error(`FAIL: ${err.message}`);
    process.exit(1);
  }
  throw err;
}
