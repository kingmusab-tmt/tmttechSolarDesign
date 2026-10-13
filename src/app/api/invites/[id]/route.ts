import { z } from "zod";
import { loadUser } from "@/lib/server/access";
import { HttpError, assertId, handler, json, readJson } from "@/lib/server/api";
import { Organization, OrgInvite } from "@/models/Organization";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({ action: z.enum(["accept", "decline"]) });

/** Accept or decline an invitation addressed to my email. */
export const POST = handler<Ctx>(async (req, ctx, session) => {
  const { id } = await ctx.params;
  assertId(id);
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(400, "Invalid action");
  const me = await loadUser(session);
  const invite = await OrgInvite.findOne({ _id: id, email: me.email, status: "pending" }).lean();
  if (!invite) throw new HttpError(404, "Invitation not found");
  if (parsed.data.action === "accept") {
    const org = await Organization.findById(invite.org).lean();
    if (!org) throw new HttpError(404, "That organisation no longer exists");
    if (!org.members.some((m) => String(m.user) === session.userId)) {
      await Organization.updateOne({ _id: org._id }, { $push: { members: { user: session.userId, role: invite.role, joinedAt: new Date() } } });
    }
  }
  await OrgInvite.updateOne({ _id: invite._id }, { $set: { status: parsed.data.action === "accept" ? "accepted" : "declined" } });
  return json({ ok: true });
});
