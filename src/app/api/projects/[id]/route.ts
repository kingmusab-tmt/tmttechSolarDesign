import { isDefaultSection, sectionWriteMode, SECTION_LABELS } from "@/lib/collab";
import { ProjectPatchSchema, SECTION_KEYS, SECTION_SCHEMAS, normalizeProject, type SectionKey } from "@/lib/schemas";
import { loadUser, projectAccess } from "@/lib/server/access";
import { HttpError, handler, json, readJson } from "@/lib/server/api";
import { buildCollab } from "@/lib/server/projects";
import { ChangeRequest } from "@/models/ChangeRequest";
import { SectionLock } from "@/models/Collab";
import { Project } from "@/models/Project";
import { Revision } from "@/models/Revision";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler<Ctx>(async (_req, ctx, session) => {
  const { id } = await ctx.params;
  const access = await projectAccess(session.userId, id);
  const me = await loadUser(session);
  return json({ project: normalizeProject(access.project as unknown as Record<string, unknown>), collab: await buildCollab(access, { id: session.userId, name: me.name }) });
});

/**
 * Partial update. For shared projects the server enforces, per section:
 *  1. ownership: information entered by someone else can only change through an approved change request;
 *  2. edit locks: a section locked by another member is read-only;
 *  3. optimistic concurrency: the client's baseRevs must match, so a stale save never overwrites newer data.
 */
export const PATCH = handler<Ctx>(async (req, ctx, session) => {
  const { id } = await ctx.params;
  const access = await projectAccess(session.userId, id);
  const body = await readJson<Record<string, unknown>>(req);
  const parsed = ProjectPatchSchema.safeParse(body);
  if (!parsed.success) throw new HttpError(400, "Invalid update");
  const baseRevs = (body.baseRevs && typeof body.baseRevs === "object" ? body.baseRevs : {}) as Record<string, number>;
  const { name, status, sections } = parsed.data;
  const p = access.project;
  const owners = { ...((p.sectionOwners ?? {}) as Record<string, string>) };
  const revs = (p.sectionRev ?? {}) as Record<string, number>;

  if ((name !== undefined || status !== undefined) && !access.canManage) throw new HttpError(403, "Only the project owner or an organisation admin can rename the project or change its status");

  const set: Record<string, unknown> = {};
  const inc: Record<string, number> = {};
  const filter: Record<string, unknown> = { _id: p._id };
  if (name !== undefined) set.name = name;
  if (status !== undefined) set.status = status;

  const keys = Object.keys(sections ?? {});
  const locks = access.shared && keys.length ? await SectionLock.find({ project: p._id, section: { $in: keys }, expiresAt: { $gt: new Date() } }).lean() : [];
  const me = keys.length ? await loadUser(session) : null;

  for (const [key, value] of Object.entries(sections ?? {})) {
    if (!SECTION_KEYS.includes(key as SectionKey)) throw new HttpError(400, `Unknown section: ${key}`);
    const section = key as SectionKey;
    const res = SECTION_SCHEMAS[section].safeParse(value);
    if (!res.success) {
      const issue = res.error.issues[0];
      throw new HttpError(400, `Invalid ${key}: ${issue?.path.join(".") || "value"} ${issue?.message ?? ""}`.trim());
    }
    if (sectionWriteMode({ shared: access.shared, section, ownerOfSection: owners[section], userId: session.userId }) === "approval") {
      return json({ error: `${SECTION_LABELS[section]} was entered by another team member. Submit your change with a comment for their approval.`, code: "approval_required", section }, 403);
    }
    const lock = locks.find((l) => l.section === section && String(l.user) !== session.userId);
    if (lock) return json({ error: `${lock.userName || "A team member"} is editing ${SECTION_LABELS[section]} right now`, code: "locked", section, lockedBy: lock.userName }, 423);

    // Optimistic concurrency: only write if nobody saved this section since the client loaded it.
    if (typeof baseRevs[section] === "number") {
      const current = revs[section] ?? 0;
      if (baseRevs[section] !== current) return conflict(p._id, [section]);
      filter[`sectionRev.${section}`] = current === 0 ? { $in: [0, null] } : current;
    }
    set[section] = res.data;
    inc[`sectionRev.${section}`] = 1;
    if (me) set[`sectionEditedBy.${section}`] = { user: session.userId, name: me.name, at: new Date().toISOString() };
    // The first person to add real information to a shared section becomes its creator.
    if (access.shared && section !== "progress" && !owners[section] && !isDefaultSection(section, res.data)) set[`sectionOwners.${section}`] = session.userId;
  }
  if (!Object.keys(set).length) throw new HttpError(400, "Nothing to update");

  const update: Record<string, unknown> = { $set: set };
  if (Object.keys(inc).length) update.$inc = inc;
  const doc = await Project.findOneAndUpdate(filter, update, { returnDocument: "after" }).lean();
  if (!doc) return conflict(p._id, keys); // a concurrent write won the race between check and update
  return json({ ok: true, updatedAt: doc.updatedAt, sectionRev: doc.sectionRev ?? {}, sectionOwners: doc.sectionOwners ?? {} });
});

async function conflict(projectId: unknown, sections: string[]) {
  const fresh = await Project.findById(projectId).lean();
  const current = fresh ? normalizeProject(fresh as unknown as Record<string, unknown>) : null;
  return json(
    {
      error: "Someone else saved this section first. It has been refreshed; please reapply your change.",
      code: "conflict",
      sections,
      current: current ? Object.fromEntries(sections.map((s) => [s, (current as unknown as Record<string, unknown>)[s]])) : {},
      sectionRev: fresh?.sectionRev ?? {},
      sectionEditedBy: fresh?.sectionEditedBy ?? {},
    },
    409,
  );
}

export const DELETE = handler<Ctx>(async (_req, ctx, session) => {
  const { id } = await ctx.params;
  const access = await projectAccess(session.userId, id);
  if (!access.isOwner) throw new HttpError(403, "Only the project owner can delete it");
  await Project.deleteOne({ _id: access.project._id });
  await Promise.all([
    Revision.deleteMany({ project: access.project._id }),
    ChangeRequest.deleteMany({ project: access.project._id }),
    SectionLock.deleteMany({ project: access.project._id }),
  ]);
  return json({ ok: true });
});
