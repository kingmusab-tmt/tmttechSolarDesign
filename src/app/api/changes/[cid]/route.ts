import { z } from "zod";
import { SECTION_LABELS } from "@/lib/collab";
import type { SectionKey } from "@/lib/schemas";
import { loadUser } from "@/lib/server/access";
import { HttpError, assertId, handler, json, readJson } from "@/lib/server/api";
import { serializeChanges } from "@/lib/server/changes";
import { ChangeRequest, type ChangeRequestDoc } from "@/models/ChangeRequest";
import { SectionLock } from "@/models/Collab";
import { Equipment } from "@/models/Equipment";
import { Project } from "@/models/Project";

type Ctx = { params: Promise<{ cid: string }> };

const Body = z.object({
  action: z.enum(["approve", "reject", "withdraw"]),
  comment: z.string().trim().max(2000).default(""),
  /** Approve even though the target changed after the proposal (overwrites those changes). */
  force: z.boolean().default(false),
});

export const POST = handler<Ctx>(async (req, ctx, session) => {
  const { cid } = await ctx.params;
  assertId(cid);
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(400, "Invalid action");
  const { action, comment, force } = parsed.data;
  const cr = await ChangeRequest.findById(cid).lean<ChangeRequestDoc>();
  if (!cr) throw new HttpError(404, "Change request not found");
  if (cr.status !== "pending") throw new HttpError(409, `This change was already ${cr.status}`);

  if (action === "withdraw") {
    if (String(cr.proposedBy) !== session.userId) throw new HttpError(403, "Only the proposer can withdraw this change");
    await ChangeRequest.updateOne({ _id: cr._id, status: "pending" }, { $set: { status: "withdrawn", reviewedAt: new Date() } });
    return json({ ok: true });
  }

  if (!cr.approvers.some((a) => String(a) === session.userId) || String(cr.proposedBy) === session.userId) throw new HttpError(403, "You are not an approver for this change");
  if (action === "reject" && comment.length < 3) throw new HttpError(400, "Add a comment explaining why the change is rejected");

  if (action === "approve") {
    const me = await loadUser(session);
    if (cr.kind === "section" && cr.project && cr.section) {
      const section = cr.section as SectionKey;
      const project = await Project.findById(cr.project).lean();
      if (!project) throw new HttpError(404, "Project no longer exists");
      const rev = (project.sectionRev as Record<string, number> | undefined)?.[section] ?? 0;
      if (rev !== cr.baseRev && !force) {
        return json({ error: `${SECTION_LABELS[section]} changed after this proposal was made. Review the current values; approving will overwrite them.`, code: "stale" }, 409);
      }
      // Only a lock held by someone who can write this section directly (its creator) can conflict
      // with applying the change. Other members (e.g. the proposer still on the page) can only
      // propose edits to it, so their lock is no reason to block the approval.
      const sectionOwner = (project.sectionOwners as Record<string, string> | undefined)?.[section];
      const lock = await SectionLock.findOne({ project: project._id, section, expiresAt: { $gt: new Date() }, user: { $ne: session.userId } }).lean();
      if (lock && String(lock.user) === sectionOwner) return json({ error: `${lock.userName || "A team member"} is editing ${SECTION_LABELS[section]} right now. Try again when they finish.`, code: "locked" }, 423);
      const proposer = (await serializeChanges([cr], session.userId))[0].proposedBy;
      const res = await Project.updateOne(
        { _id: project._id, [`sectionRev.${section}`]: rev === 0 ? { $in: [0, null] } : rev },
        {
          $set: { [section]: cr.value, [`sectionEditedBy.${section}`]: { user: proposer.id, name: `${proposer.name} (approved by ${me.name})`, at: new Date().toISOString() } },
          $inc: { [`sectionRev.${section}`]: 1 },
        },
      );
      if (!res.modifiedCount) throw new HttpError(409, "The section changed while approving; please retry");
    } else if (cr.kind === "equipment" && cr.equipment) {
      const res = await Equipment.updateOne({ _id: cr.equipment }, { $set: cr.value as Record<string, unknown> });
      if (!res.matchedCount) throw new HttpError(404, "Equipment no longer exists");
    }
  }

  await ChangeRequest.updateOne(
    { _id: cr._id, status: "pending" },
    { $set: { status: action === "approve" ? "approved" : "rejected", reviewedBy: session.userId, reviewComment: comment, reviewedAt: new Date() } },
  );
  const updated = await ChangeRequest.findById(cr._id).lean<ChangeRequestDoc>();
  return json({ ok: true, change: (await serializeChanges([updated!], session.userId))[0] });
});
