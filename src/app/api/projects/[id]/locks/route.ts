import { z } from "zod";
import { LOCK_TTL_MS, SECTION_LABELS } from "@/lib/collab";
import { SECTION_KEYS, type SectionKey } from "@/lib/schemas";
import { loadUser, projectAccess } from "@/lib/server/access";
import { HttpError, handler, json, readJson } from "@/lib/server/api";
import { SectionLock } from "@/models/Collab";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({
  action: z.enum(["acquire", "renew", "release"]),
  sections: z.array(z.enum(SECTION_KEYS as [SectionKey, ...SectionKey[]])).max(SECTION_KEYS.length).default([]),
  step: z.string().max(40).default(""),
});

/**
 * Soft edit locks for shared projects. Acquire is all-or-nothing across the step's sections:
 * if any is held by someone else, nothing is locked and the holder is reported.
 */
export const POST = handler<Ctx>(async (req, ctx, session) => {
  const { id } = await ctx.params;
  const access = await projectAccess(session.userId, id);
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(400, "Invalid lock request");
  const { action, sections, step } = parsed.data;
  if (!access.shared) return json({ ok: true, shared: false }); // personal projects need no locks
  const projectId = access.project._id;

  if (action === "release") {
    await SectionLock.deleteMany({ project: projectId, user: session.userId, ...(sections.length ? { section: { $in: sections } } : {}) });
    return json({ ok: true });
  }

  const me = await loadUser(session);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LOCK_TTL_MS);
  const acquired: string[] = [];
  for (const section of sections) {
    try {
      // Take the lock if it is free, expired, or already ours. The unique (project, section)
      // index makes the upsert fail when another member holds a live lock.
      await SectionLock.findOneAndUpdate(
        { project: projectId, section, $or: [{ user: session.userId }, { expiresAt: { $lte: now } }] },
        { $set: { user: session.userId, userName: me.name, step, expiresAt } },
        { upsert: true },
      );
      acquired.push(section);
    } catch {
      const holder = await SectionLock.findOne({ project: projectId, section }).lean();
      // Roll back the partial acquisition so we never hold half a step.
      if (action === "acquire" && acquired.length) await SectionLock.deleteMany({ project: projectId, user: session.userId, section: { $in: acquired } });
      return json(
        { ok: false, code: "locked", section, lockedBy: holder?.userName ?? "A team member", error: `${holder?.userName ?? "A team member"} is editing ${SECTION_LABELS[section]}` },
        423,
      );
    }
  }
  return json({ ok: true, sections: acquired, expiresAt });
});
