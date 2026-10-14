import type { Metadata } from "next";
import { PRIVATE } from "@/lib/seo";
import { redirect } from "next/navigation";
import { EquipmentManager } from "@/components/EquipmentManager";
import { getSession } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Equipment library", robots: PRIVATE };

export default async function EquipmentPage() {
  if (!(await getSession())) redirect("/login");
  return <EquipmentManager />;
}
