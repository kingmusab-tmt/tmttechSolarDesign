import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountForm } from "@/components/AccountForm";
import { getSession } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  if (!(await getSession())) redirect("/login");
  return <AccountForm />;
}
