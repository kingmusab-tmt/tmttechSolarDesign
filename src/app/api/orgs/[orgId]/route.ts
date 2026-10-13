import { z } from "zod";
import { HttpError, handler, json, readJson } from "@/lib/server/api";
import { loadOrgForRole } from "@/lib/server/orgs";
import { ChangeRequest } from "@/models/ChangeRequest";
import { Presence, SectionLock } from "@/models/Collab";
import { Equipment } from "@/models/Equipment";
import { Organization, OrgInvite } from "@/models/Organization";
import { Project } from "@/models/Project";

type Ctx = { params: Promise<{ orgId: string }> };

const Body = z.object({ name: z.string().trim().min(2).max(120) });

export const PATCH = handler<Ctx>(async (req, ctx, session) => {
  const { orgId } = await ctx.params;
  const { org } = await loadOrgForRole(orgId, session.userId, ["owner", "admin"]);
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(400, "Organisation name must be at least 2 characters");
  await Organization.updateOne({ _id: org._id }, { $set: { name: parsed.data.name } });
  return json({ ok: true });
});

/** Delete the organisation. Shared projects and equipment become personal to their owners again. */
export const DELETE = handler<Ctx>(async (_req, ctx, session) => {
  const { orgId } = await ctx.params;
  const { org } = await loadOrgForRole(orgId, session.userId, ["owner"]);
  const projects = await Project.find({ org: org._id }, { _id: 1 }).lean();
  const ids = projects.map((p) => p._id);
  await Promise.all([
    Project.updateMany({ org: org._id }, { $set: { org: null } }),
    Equipment.updateMany({ org: org._id }, { $set: { org: null } }),
    ChangeRequest.updateMany({ org: org._id, status: "pending" }, { $set: { status: "withdrawn", reviewComment: "Organisation was deleted" } }),
    SectionLock.deleteMany({ project: { $in: ids } }),
    Presence.deleteMany({ project: { $in: ids } }),
    OrgInvite.deleteMany({ org: org._id }),
  ]);
  await Organization.deleteOne({ _id: org._id });
  return json({ ok: true });
});
