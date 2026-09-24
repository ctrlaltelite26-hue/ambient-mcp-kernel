import { redirect } from "next/navigation";

import { HostApp } from "@/components/HostApp";
import { isAuthenticated } from "@/lib/auth";

export default async function HomePage() {
  if (!(await isAuthenticated())) redirect("/login");
  return <HostApp />;
}
