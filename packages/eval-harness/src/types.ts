import { z } from "zod";

/** Shared envelope — do not fork for Threshold; track-specific fields live in input/expected. */
export const ScenarioSchema = z
  .object({
    id: z.string().min(1),
    track: z.enum(["alexa", "ring"]),
    taxonomy: z.array(z.string().min(1)).min(1),
    heldOut: z.boolean().default(false),
    input: z.record(z.string(), z.unknown()),
    expected: z
      .object({
        verdict: z.string().min(1),
        mustNotExecute: z.array(z.string()).optional(),
        mustNot: z.array(z.string()).optional(),
      })
      .strict(),
  })
  .strict();

export type Scenario = z.infer<typeof ScenarioSchema>;

export const AlexaInputSchema = z
  .object({
    utterance: z.string().min(1),
    speaker: z.enum(["adult", "child", "guest"]).nullable(),
    context: z
      .object({
        amountMinor: z.number().int().nonnegative().optional(),
        item: z.string().optional(),
        /** Adapter pre-seeds this many open proposals; kernel resolves vague/cancel referents. */
        openOrderCount: z.number().int().nonnegative().optional(),
        /** Host-listed propose_order description; hashed against the pinned catalog. */
        invokedToolDescription: z.string().optional(),
        /** After a successful propose, commit with a drifted / stale / stolen hash. */
        tamperCommit: z.enum(["drift", "ttl", "guest_reuse"]).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type AlexaInput = z.infer<typeof AlexaInputSchema>;

export type ColumnVerdict = "allow" | "elicit" | "deny" | "escalate" | string;

export interface ColumnResult {
  verdict: ColumnVerdict;
  /** Tools/actions that actually executed (irreversible side effects). */
  executed: string[];
  notes?: string;
  latencyMs?: number;
}

export interface RunRow {
  scenarioId: string;
  track: Scenario["track"];
  heldOut: boolean;
  taxonomy: string[];
  expectedVerdict: string;
  baseline: ColumnResult;
  treatment: ColumnResult;
  ablation: ColumnResult;
  /** True when treatment matches expected verdict and respects must-not lists. */
  pass: boolean;
  notes?: string;
}

export interface SystemAdapter {
  readonly name: string;
  run(scenario: Scenario): ColumnResult | Promise<ColumnResult>;
}

export interface ClaimSummary {
  total: number;
  heldOut: number;
  treatmentPass: number;
  treatmentFail: number;
  /** Irreversible executes when expected said deny / listed mustNot. */
  baselineBypasses: number;
  treatmentBypasses: number;
  ablationBypasses: number;
  falseRefusals: number;
}
