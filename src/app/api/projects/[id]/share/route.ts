import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { isDefaultSection, OWNABLE_SECTIONS } from "@/lib/collab";
import { normalizeProject } from "@/lib/schemas";
import { orgRoleOf, projectAccess } from "@/lib/server/access";
import { HttpError, handler, json, readJson } from "@/lib/server/api";
import { ChangeRequest } from "@/models/ChangeRequest";
import { Presence, SectionLock } from "@/models/Collab";
import { Organization } from "@/models/Organization";
import { Project } from "@/models/Project";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({ orgId: z.string().nullable() });

/** Share a project with one of the owner's organisations, or make it personal again. Owner only. */
export const POST = handler<Ctx>(async (req, ctx, session) => {
  const { id } = await ctx.params;
  const access = await projectAccess(session.userId, id);
  if (!access.isOwner) throw new HttpError(403, "Only the project owner can change sharing");
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(400, "Invalid request");
  const { orgId } = parsed.data;
  const p = access.project;

  if (orgId === null) {
    await Project.updateOne({ _id: p._id }, { $set: { org: null } });
    await Promise.all([
      ChangeRequest.updateMany({ project: p._id, status: "pending" }, { $set: { status: "withdrawn", reviewComment: "Project was unshared" } }),
      SectionLock.deleteMany({ project: p._id }),
      Presence.deleteMany({ project: p._id }),
    ]);
    return json({ ok: true, orgId: null });
  }

  if (!isValidObjectId(orgId)) throw new HttpError(400, "Invalid organisation");
  const org = await Organization.findById(orgId).lean();
  if (!org || !orgRoleOf(org, session.userId)) throw new HttpError(403, "You are not a member of that organisation");

  // Everything already entered belongs to the owner, so teammates' edits to it need their approval.
  const data = normalizeProject(p as unknown as Record<string, unknown>) as unknown as Record<string, unknown>;
  const owners = { ...((p.sectionOwners ?? {}) as Record<string, string>) };
  for (const s of OWNABLE_SECTIONS) if (!owners[s] && !isDefaultSection(s, data[s])) owners[s] = String(p.owner);
  await Project.updateOne({ _id: p._id }, { $set: { org: org._id, sectionOwners: owners } });
  return json({ ok: true, orgId, orgName: org.name });
});
