import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { AUTH_COOKIE, expectedPassword } from "@/lib/auth";

export async function POST(req: Request) {
  const body = (await req.json()) as { password?: string };
  if ((body.password ?? "") !== expectedPassword()) {
    return NextResponse.json({ ok: false, error: "Invalid access code" }, { status: 401 });
  }
  const jar = await cookies();
  jar.set(AUTH_COOKIE, "ok", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return NextResponse.json({ ok: true });
}
