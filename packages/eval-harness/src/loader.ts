import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

import { AlexaInputSchema, ScenarioSchema, type Scenario } from "./types.js";

export class ScenarioLoadError extends Error {
  constructor(
    message: string,
    readonly path?: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ScenarioLoadError";
  }
}

function walkJsonFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith("_") || name.startsWith("HELD_OUT")) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walkJsonFiles(full));
    else if (extname(name) === ".json") out.push(full);
  }
  return out.sort();
}

export function loadScenarioFile(path: string): Scenario {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    throw new ScenarioLoadError(`Invalid JSON: ${path}`, path, err);
  }

  const parsed = ScenarioSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ScenarioLoadError(
      `Schema validation failed for ${path}: ${parsed.error.message}`,
      path,
      parsed.error,
    );
  }

  const scenario = parsed.data;
  if (scenario.track === "alexa") {
    const input = AlexaInputSchema.safeParse(scenario.input);
    if (!input.success) {
      throw new ScenarioLoadError(
        `Alexa input validation failed for ${path}: ${input.error.message}`,
        path,
        input.error,
      );
    }
  }

  return scenario;
}

export function loadCorpus(dir: string): Scenario[] {
  const files = walkJsonFiles(dir);
  if (files.length === 0) {
    throw new ScenarioLoadError(`No scenario JSON files found under ${dir}`, dir);
  }

  const scenarios = files.map(loadScenarioFile);
  const ids = new Set<string>();
  for (const s of scenarios) {
    if (ids.has(s.id)) {
      throw new ScenarioLoadError(`Duplicate scenario id: ${s.id}`);
    }
    ids.add(s.id);
  }
  return scenarios;
}
