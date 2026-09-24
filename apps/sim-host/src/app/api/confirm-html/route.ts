import { NextResponse } from "next/server";

import { isAuthenticated } from "@/lib/auth";
import { readConfirmHtml } from "@/lib/mcp";

/** Sim-host owns Approve/Deny. Flag hides the card's own CTAs (MCP Inspector still shows them). */
function withHostControls(html: string): string {
  if (html.includes("__CHAPERONE_HOST_CONTROLS__")) return html;
  return html.replace(
    "<script type=\"module\">",
    "<script>globalThis.__CHAPERONE_HOST_CONTROLS__ = true;</script>\n<script type=\"module\">",
  );
}

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const html = withHostControls(await readConfirmHtml());
    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
