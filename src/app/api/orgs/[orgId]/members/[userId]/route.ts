import { z } from "zod";
import { HttpError, handler, json, readJson } from "@/lib/server/api";
import { loadOrgForRole } from "@/lib/server/orgs";
import { Presence, SectionLock } from "@/models/Collab";
import { Organization } from "@/models/Organization";
import { Project } from "@/models/Project";

type Ctx = { params: Promise<{ orgId: string; userId: string }> };

const Body = z.object({ role: z.enum(["admin", "member"]) });

/** Change a member's role (owner only). */
export const PATCH = handler<Ctx>(async (req, ctx, session) => {
  const { orgId, userId } = await ctx.params;
  const { org } = await loadOrgForRole(orgId, session.userId, ["owner"]);
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(400, "Role must be admin or member");
  const member = org.members.find((m) => String(m.user) === userId);
  if (!member) throw new HttpError(404, "Member not found");
  if (member.role === "owner") throw new HttpError(400, "The owner's role cannot be changed");
  await Organization.updateOne({ _id: org._id, "members.user": member.user }, { $set: { "members.$.role": parsed.data.role } });
  return json({ ok: true });
});

/** Remove a member (owner/admin), or leave the organisation yourself. */
export const DELETE = handler<Ctx>(async (_req, ctx, session) => {
  const { orgId, userId } = await ctx.params;
  const leaving = userId === session.userId;
  const { org, role } = await loadOrgForRole(orgId, session.userId, leaving ? ["owner", "admin", "member"] : ["owner", "admin"]);
  const member = org.members.find((m) => String(m.user) === userId);
  if (!member) throw new HttpError(404, "Member not found");
  if (member.role === "owner") throw new HttpError(400, leaving ? "The owner cannot leave; delete the organisation instead" : "The owner cannot be removed");
  if (!leaving && member.role === "admin" && role !== "owner") throw new HttpError(403, "Only the owner can remove an admin");
  await Organization.updateOne({ _id: org._id }, { $pull: { members: { user: member.user } } });
  const projects = await Project.find({ org: org._id }, { _id: 1 }).lean();
  await Promise.all([
    SectionLock.deleteMany({ project: { $in: projects.map((p) => p._id) }, user: member.user }),
    Presence.deleteMany({ project: { $in: projects.map((p) => p._id) }, user: member.user }),
  ]);
  return json({ ok: true });
});
