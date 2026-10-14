import type { Metadata } from "next";
import { publicPage } from "@/lib/seo";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { getSession } from "@/lib/server/auth";

export const metadata: Metadata = publicPage("/register", "Create a free account", "Create a free account to design solar home systems step by step: sizing, string design, single-line diagrams, Bill of Quantities and financial reports.");

export default async function RegisterPage() {
  if (await getSession()) redirect("/dashboard");
  return <AuthForm mode="register" />;
}
