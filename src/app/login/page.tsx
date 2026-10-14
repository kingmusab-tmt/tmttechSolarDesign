import type { Metadata } from "next";
import { publicPage } from "@/lib/seo";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { getSession } from "@/lib/server/auth";

export const metadata: Metadata = publicPage("/login", "Sign in", "Sign in to continue your solar home system designs, projects and team approvals.");

export default async function LoginPage() {
  if (await getSession()) redirect("/dashboard");
  return <AuthForm mode="login" />;
}
