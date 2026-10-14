import type { Metadata } from "next";
import { PRIVATE } from "@/lib/seo";
import { redirect } from "next/navigation";
import { AccountForm } from "@/components/AccountForm";
import { getSession } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Account", robots: PRIVATE };

export default async function AccountPage() {
  if (!(await getSession())) redirect("/login");
  return <AccountForm />;
}
