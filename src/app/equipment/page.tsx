import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EquipmentManager } from "@/components/EquipmentManager";
import { getSession } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Equipment library" };

export default async function EquipmentPage() {
  if (!(await getSession())) redirect("/login");
  return <EquipmentManager />;
}
