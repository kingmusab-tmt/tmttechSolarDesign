import { EquipmentBody } from "@/lib/equipment-schema";
import { HttpError, handler, json, readJson } from "@/lib/server/api";
import { equipmentAccess } from "@/lib/server/equipment";
import { ChangeRequest } from "@/models/ChangeRequest";
import { Equipment } from "@/models/Equipment";
import { EquipmentDatasheet } from "@/models/EquipmentDatasheet";

type Ctx = { params: Promise<{ id: string }> };

/** Edit your own item. Shared items created by someone else change only through an approved proposal. */
export const PATCH = handler<Ctx>(async (req, ctx, session) => {
  const { id } = await ctx.params;
  const { item, mine, sharedWithMe } = await equipmentAccess(session.userId, id);
  if (!mine) {
    if (sharedWithMe) return json({ error: "This item was created by a teammate. Suggest your change with a comment for their approval.", code: "approval_required" }, 403);
    throw new HttpError(403, "Built-in library items are maintained by administrators");
  }
  const parsed = EquipmentBody.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message.startsWith("Datasheet") ? parsed.error.issues[0].message : "Invalid equipment");
  await Equipment.updateOne({ _id: item._id }, { $set: { ...parsed.data, type: item.type } });
  return json({ ok: true });
});

export const DELETE = handler<Ctx>(async (_req, ctx, session) => {
  const { id } = await ctx.params;
  const { item, mine } = await equipmentAccess(session.userId, id);
  if (!mine) throw new HttpError(403, "Only the creator can delete this item");
  await Equipment.deleteOne({ _id: item._id });
  await Promise.all([
    EquipmentDatasheet.deleteOne({ equipment: item._id }),
    ChangeRequest.updateMany({ equipment: item._id, status: "pending" }, { $set: { status: "withdrawn", reviewComment: "Item was deleted" } }),
  ]);
  return json({ ok: true });
});
