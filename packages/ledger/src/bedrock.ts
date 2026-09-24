/**
 * Bedrock stretch — optional utterance hints only.
 * NEVER decides allow/deny/elicit (policy owns verdicts).
 *
 * Wire with CHAPERONE_BEDROCK=1 + model id when ready; default is stub.
 */
export interface UtteranceHint {
  likelyChildIntent: boolean;
  likelyAdSpeech: boolean;
  notes: string[];
  source: "stub" | "bedrock";
}

export function classifyUtteranceStub(utterance: string): UtteranceHint {
  const lower = utterance.toLowerCase();
  return {
    likelyChildIntent: /\b(candy|toy|game|please mom)\b/.test(lower),
    likelyAdSpeech: /\b(order me|buy now|limited time)\b/.test(lower),
    notes: ["stub classifier — not used for policy decisions"],
    source: "stub",
  };
}

/**
 * Placeholder for Converse API. Returns stub until CHAPERONE_BEDROCK=1 is set
 * and a real client is implemented. Policy must ignore this for verdicts.
 */
export async function classifyUtterance(utterance: string): Promise<UtteranceHint> {
  if (process.env.CHAPERONE_BEDROCK !== "1") {
    return classifyUtteranceStub(utterance);
  }
  // Stretch: InvokeModel / Converse here. Fall back so demos never block.
  return {
    ...classifyUtteranceStub(utterance),
    notes: [
      "CHAPERONE_BEDROCK=1 set but live Converse not wired — using stub",
      "Policy engine remains sole authority for allow/deny/elicit",
    ],
    source: "stub",
  };
}
