import { z } from "zod";

export const EQUIPMENT_TYPES = ["panel", "inverter", "battery", "controller"] as const;
export type EquipmentType = (typeof EQUIPMENT_TYPES)[number];

const httpUrl = z
  .string()
  .trim()
  .max(1000)
  .refine((v) => v === "" || /^https?:\/\/[^\s]+\.[^\s]+/i.test(v), "Datasheet link must start with http:// or https://");

export const EquipmentBody = z.object({
  type: z.enum(EQUIPMENT_TYPES),
  brand: z.string().trim().max(120).default(""),
  model: z.string().trim().min(1).max(200),
  specs: z.record(z.string(), z.union([z.number().finite(), z.string().max(64)])).default({}),
  /** Link to the manufacturer's original datasheet. */
  datasheetUrl: httpUrl.default(""),
  /** Provenance, e.g. "CEC module list; weight estimated". */
  notes: z.string().trim().max(500).default(""),
});

/** Admins can also mark built-in items as verified against the official datasheet. */
export const AdminEquipmentBody = EquipmentBody.extend({ verified: z.boolean().default(false) });

export interface EquipmentItem {
  _id: string;
  type: EquipmentType;
  brand: string;
  model: string;
  specs: Record<string, number | string>;
  builtIn: boolean;
  datasheetUrl: string;
  notes: string;
  /** Built-in item whose values were transcribed from the official datasheet. */
  verified: boolean;
  /** Created by the current user (may edit and share directly). */
  mine: boolean;
  ownerName: string;
  /** Organisation the item is shared with, if any. */
  orgId: string | null;
  orgName: string;
  source: "seed" | "admin" | "user";
  retired: boolean;
  /** Your own item: whether an administrator added it to the global library. */
  libraryStatus?: "added" | "dismissed" | null;
  /** Library item that came from a user's submission: who contributed it. */
  contributedByName?: string;
}
