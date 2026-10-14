import type { Metadata } from "next";
import { PRIVATE } from "@/lib/seo";
import { notFound, redirect } from "next/navigation";
import { AdminConsole } from "@/components/admin/AdminConsole";
import { getSession } from "@/lib/server/auth";
import { connectDB } from "@/lib/server/db";
import { User } from "@/models/User";

export const metadata: Metadata = { title: "Admin", robots: PRIVATE };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  await connectDB();
  const me = await User.findById(session.userId, { role: 1 }).lean();
  if (me?.role !== "admin") notFound(); // do not reveal that the page exists
  return <AdminConsole />;
}
