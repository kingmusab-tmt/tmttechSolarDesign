import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { AdminEquipmentBody } from "@/lib/equipment-schema";
import { requireAdmin } from "@/lib/server/access";
import { HttpError, handler, json, readJson } from "@/lib/server/api";
import { libraryKey } from "@/lib/server/equipment";
import { Equipment, type EquipmentDoc } from "@/models/Equipment";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.discriminatedUnion("action", [
  // Values as the admin checked/corrected them; targetId = update that library item instead of adding a new one.
  z.object({ action: z.literal("add"), item: AdminEquipmentBody.omit({ type: true }), targetId: z.string().optional() }),
  z.object({ action: z.literal("dismiss"), comment: z.string().trim().max(500).default("") }),
  z.object({ action: z.literal("reopen") }),
]);

/**
 * Review a user's item: add it (with any corrections) to the global library, use it to update the
 * matching library item, dismiss it, or put it back in the queue. The user's own copy is never changed.
 */
export const POST = handler<Ctx>(async (req, ctx, session) => {
  await requireAdmin(session);
  const { id } = await ctx.params;
  if (!isValidObjectId(id)) throw new HttpError(404, "Item not found");
  const sub = await Equipment.findOne({ _id: id, owner: { $ne: null } }).lean<EquipmentDoc>();
  if (!sub) throw new HttpError(404, "Item not found");
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid request");
  const body = parsed.data;
  const reviewed = { by: session.userId, at: new Date() };

  if (body.action === "reopen") {
    await Equipment.updateOne({ _id: sub._id }, { $unset: { review: "" } }, { timestamps: false });
    return json({ ok: true });
  }
  if (body.action === "dismiss") {
    await Equipment.updateOne({ _id: sub._id }, { $set: { review: { status: "dismissed", ...reviewed, comment: body.comment } } }, { timestamps: false });
    return json({ ok: true });
  }

  const values = { ...body.item, type: sub.type };
  let libraryId;
  if (body.targetId) {
    if (!isValidObjectId(body.targetId)) throw new HttpError(404, "Library item not found");
    const target = await Equipment.findOne({ _id: body.targetId, owner: null, type: sub.type }).lean();
    if (!target) throw new HttpError(404, "Library item not found");
    await Equipment.updateOne({ _id: target._id }, { $set: { ...values, retired: false, adminEdited: true } });
    libraryId = target._id;
  } else {
    const key = libraryKey(values);
    const existing = (await Equipment.find({ owner: null, type: sub.type, retired: { $ne: true } }, { type: 1, brand: 1, model: 1 }).lean()).find((l) => libraryKey(l) === key);
    if (existing) return json({ error: "The library already has this brand and model. Update that item instead.", code: "duplicate", matchId: String(existing._id) }, 409);
    const doc = await Equipment.create({ ...values, owner: null, source: "admin", contributedBy: sub.owner ?? undefined });
    libraryId = doc._id;
  }
  await Equipment.updateOne({ _id: sub._id }, { $set: { review: { status: "added", ...reviewed, libraryItem: libraryId, comment: "" } } }, { timestamps: false });
  return json({ ok: true, libraryItem: String(libraryId) });
});
