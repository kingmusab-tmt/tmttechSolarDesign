import type { Metadata } from "next";
import { PRIVATE } from "@/lib/seo";
import { redirect } from "next/navigation";
import { ApprovalsInbox } from "@/components/ApprovalsInbox";
import { getSession } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Approvals", robots: PRIVATE };

export default async function ApprovalsPage() {
  if (!(await getSession())) redirect("/login");
  return <ApprovalsInbox />;
}
