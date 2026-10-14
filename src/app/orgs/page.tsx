import type { Metadata } from "next";
import { PRIVATE } from "@/lib/seo";
import { redirect } from "next/navigation";
import { OrgsManager } from "@/components/OrgsManager";
import { getSession } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Organisations", robots: PRIVATE };

export default async function OrgsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <OrgsManager meId={session.userId} />;
}
