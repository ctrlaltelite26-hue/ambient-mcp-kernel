import { NextResponse } from "next/server";

import { isAuthenticated } from "@/lib/auth";
import { callToolJson, type SpeakerId } from "@/lib/mcp";

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json()) as {
    sessionId: string;
    speakerMemberId: SpeakerId;
    intent: string;
    sku?: string;
    invokedToolDescription?: string;
  };

  try {
    const result = await callToolJson("propose_order", {
      sessionId: body.sessionId,
      speakerMemberId: body.speakerMemberId,
      intent: body.intent,
      sku: body.sku ?? "coffee",
      qty: 1,
      invokedToolDescription: body.invokedToolDescription,
    });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
