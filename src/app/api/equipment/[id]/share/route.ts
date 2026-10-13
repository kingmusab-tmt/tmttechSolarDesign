import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { orgRoleOf } from "@/lib/server/access";
import { HttpError, handler, json, readJson } from "@/lib/server/api";
import { equipmentAccess } from "@/lib/server/equipment";
import { Equipment } from "@/models/Equipment";
import { Organization } from "@/models/Organization";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({ orgId: z.string().nullable() });

/** Share one of your items with an organisation you belong to (or stop sharing). */
export const POST = handler<Ctx>(async (req, ctx, session) => {
  const { id } = await ctx.params;
  const { item, mine } = await equipmentAccess(session.userId, id);
  if (!mine) throw new HttpError(403, "Only the creator can change sharing");
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(400, "Invalid request");
  const { orgId } = parsed.data;
  if (orgId !== null) {
    if (!isValidObjectId(orgId)) throw new HttpError(400, "Invalid organisation");
    const org = await Organization.findById(orgId).lean();
    if (!org || !orgRoleOf(org, session.userId)) throw new HttpError(403, "You are not a member of that organisation");
  }
  await Equipment.updateOne({ _id: item._id }, { $set: { org: orgId } });
  return json({ ok: true });
});
