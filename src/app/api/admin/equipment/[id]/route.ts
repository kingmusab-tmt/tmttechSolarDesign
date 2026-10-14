import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { EquipmentBody } from "@/lib/equipment-schema";
import { requireAdmin } from "@/lib/server/access";
import { HttpError, handler, json, readJson } from "@/lib/server/api";
import { Equipment } from "@/models/Equipment";

type Ctx = { params: Promise<{ id: string }> };

const Patch = EquipmentBody.partial().extend({ verified: z.boolean().optional(), retired: z.boolean().optional() });

async function builtIn(id: string) {
  if (!isValidObjectId(id)) throw new HttpError(404, "Item not found");
  const item = await Equipment.findOne({ _id: id, owner: null }).lean();
  if (!item) throw new HttpError(404, "Item not found");
  return item;
}

/** Edit, retire or restore a built-in item. Edited seed items are no longer overwritten by seed updates. */
export const PATCH = handler<Ctx>(async (req, ctx, session) => {
  await requireAdmin(session);
  const { id } = await ctx.params;
  const item = await builtIn(id);
  const raw = await readJson<Record<string, unknown>>(req);
  const parsed = Patch.safeParse(raw);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid update");
  // Only change fields actually sent: .partial() still fills schema defaults ("" / {}) for missing
  // keys, which would otherwise wipe brand, specs and notes when e.g. just restoring an item.
  const set = Object.fromEntries(Object.entries(parsed.data).filter(([k]) => k !== "type" && k in raw));
  if (!Object.keys(set).length) throw new HttpError(400, "Nothing to update");
  await Equipment.updateOne({ _id: item._id }, { $set: { ...set, adminEdited: true } });
  return json({ ok: true });
});

/** Retire (soft delete): hidden from users, existing designs keep their copied values. */
export const DELETE = handler<Ctx>(async (_req, ctx, session) => {
  await requireAdmin(session);
  const { id } = await ctx.params;
  const item = await builtIn(id);
  await Equipment.updateOne({ _id: item._id }, { $set: { retired: true, adminEdited: true } });
  return json({ ok: true });
});
