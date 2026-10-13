import { SECTION_KEYS } from "@/lib/schemas";
import { projectAccess } from "@/lib/server/access";
import { HttpError, assertId, handler, json } from "@/lib/server/api";
import { Project } from "@/models/Project";
import { Revision, revisionLabel } from "@/models/Revision";

type Ctx = { params: Promise<{ id: string; rid: string }> };

/** Restore: copy a revision's design inputs back into the working project (progress is kept). */
export const POST = handler<Ctx>(async (_req, ctx, session) => {
  const { id, rid } = await ctx.params;
  assertId(rid);
  const access = await projectAccess(session.userId, id);
  // Restoring replaces every section, including teammates' work: owner or organisation admin only.
  if (!access.canManage) throw new HttpError(403, "Only the project owner or an organisation admin can restore a revision");
  const rev = await Revision.findOne({ _id: rid, project: id }).lean();
  if (!rev) throw new HttpError(404, "Revision not found");
  const set: Record<string, unknown> = {};
  const inc: Record<string, number> = {};
  for (const k of SECTION_KEYS)
    if (k !== "progress" && rev.snapshot[k] !== undefined) {
      set[k] = rev.snapshot[k];
      inc[`sectionRev.${k}`] = 1; // open editors pick up the restored values on their next sync
    }
  const res = await Project.updateOne({ _id: id }, { $set: set, $inc: inc });
  if (!res.matchedCount) throw new HttpError(404, "Project not found");
  return json({ ok: true, restored: revisionLabel(rev.number) });
});

export const DELETE = handler<Ctx>(async (_req, ctx, session) => {
  const { id, rid } = await ctx.params;
  assertId(rid);
  const access = await projectAccess(session.userId, id);
  if (!access.canManage) throw new HttpError(403, "Only the project owner or an organisation admin can delete revisions");
  const res = await Revision.deleteOne({ _id: rid, project: id });
  if (!res.deletedCount) throw new HttpError(404, "Revision not found");
  return json({ ok: true });
});
