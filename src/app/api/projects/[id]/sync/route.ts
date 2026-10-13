import { PRESENCE_TTL_MS, type LockInfo, type PresenceInfo } from "@/lib/collab";
import { loadUser, projectAccess, userNames } from "@/lib/server/access";
import { handler, json } from "@/lib/server/api";
import { ChangeRequest } from "@/models/ChangeRequest";
import { Presence, SectionLock } from "@/models/Collab";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Polled every few seconds by an open shared project: records presence, and returns section
 * revisions (so the client can pull teammates' saved changes), active locks, who is online,
 * and pending change-request counts.
 */
export const GET = handler<Ctx>(async (req, ctx, session) => {
  const { id } = await ctx.params;
  const access = await projectAccess(session.userId, id);
  const p = access.project;
  const step = (new URL(req.url).searchParams.get("step") ?? "").slice(0, 40);
  const now = new Date();

  if (access.shared) {
    const me = await loadUser(session);
    await Presence.updateOne({ project: p._id, user: session.userId }, { $set: { userName: me.name, step, expiresAt: new Date(now.getTime() + PRESENCE_TTL_MS) } }, { upsert: true });
  }

  const [locks, presence, forMe, mine] = await Promise.all([
    access.shared ? SectionLock.find({ project: p._id, expiresAt: { $gt: now } }).lean() : [],
    access.shared ? Presence.find({ project: p._id, expiresAt: { $gt: now }, user: { $ne: session.userId } }).lean() : [],
    ChangeRequest.countDocuments({ project: p._id, status: "pending", approvers: session.userId, proposedBy: { $ne: session.userId } }),
    ChangeRequest.countDocuments({ project: p._id, status: "pending", proposedBy: session.userId }),
  ]);
  const owners = (p.sectionOwners ?? {}) as Record<string, string>;
  const names = await userNames(Object.values(owners));

  return json({
    sectionRev: p.sectionRev ?? {},
    sectionEditedBy: p.sectionEditedBy ?? {},
    sectionOwners: Object.fromEntries(Object.entries(owners).map(([s, uid]) => [s, { id: uid, name: names[uid] ?? "Team member" }])),
    locks: locks.map((l): LockInfo => ({ section: l.section, userId: String(l.user), userName: l.userName, step: l.step })),
    presence: presence.map((x): PresenceInfo => ({ userId: String(x.user), userName: x.userName, step: x.step })),
    pending: { forMe, mine },
    name: p.name,
    status: p.status,
  });
});
