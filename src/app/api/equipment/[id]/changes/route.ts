import { z } from "zod";
import { sameValue } from "@/lib/collab";
import { EquipmentBody } from "@/lib/equipment-schema";
import { HttpError, handler, json, readJson } from "@/lib/server/api";
import { serializeChanges } from "@/lib/server/changes";
import { equipmentAccess } from "@/lib/server/equipment";
import { ChangeRequest, type ChangeRequestDoc } from "@/models/ChangeRequest";
import { equipmentEditable } from "@/models/Equipment";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({
  value: EquipmentBody,
  comment: z.string().trim().min(3, "Explain your change in a comment (at least 3 characters)").max(2000),
});

/** Suggest a change to a shared item a teammate created. Applied when the creator approves. */
export const POST = handler<Ctx>(async (req, ctx, session) => {
  const { id } = await ctx.params;
  const { item, sharedWithMe } = await equipmentAccess(session.userId, id);
  if (!sharedWithMe) throw new HttpError(400, "Change requests are only for items a teammate shared with you");
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid proposal");
  const proposed = equipmentEditable(parsed.data.value);
  const current = equipmentEditable(item);
  if (sameValue(proposed, current)) throw new HttpError(400, "Nothing changed");
  const doc = await ChangeRequest.create({
    kind: "equipment",
    equipment: item._id,
    org: item.org ?? null,
    proposedBy: session.userId,
    approvers: [item.owner!], // sharedWithMe guarantees a creator
    comment: parsed.data.comment,
    value: proposed,
    baseValue: current,
  });
  return json({ change: (await serializeChanges([doc.toObject() as unknown as ChangeRequestDoc], session.userId))[0] }, 201);
});
