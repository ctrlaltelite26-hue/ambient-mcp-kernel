import { cookies } from "next/headers";

export const AUTH_COOKIE = "chaperone_judge";

export function expectedPassword(): string {
  return process.env.JUDGE_PASSWORD ?? "household";
}

export async function isAuthenticated(): Promise<boolean> {
  const jar = await cookies();
  return jar.get(AUTH_COOKIE)?.value === "ok";
}
