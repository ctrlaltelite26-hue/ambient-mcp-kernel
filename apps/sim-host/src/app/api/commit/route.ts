import { NextResponse } from "next/server";

import { isAuthenticated } from "@/lib/auth";
import { callToolJson } from "@/lib/mcp";

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json()) as {
    sessionId: string;
    payloadHash: string;
    actorMemberId?: "maya" | "leo" | "guest";
  };

  try {
    const result = await callToolJson("commit_order", {
      sessionId: body.sessionId,
      payloadHash: body.payloadHash,
      actorMemberId: body.actorMemberId ?? "maya",
    });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
