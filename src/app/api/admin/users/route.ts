import { requireAdmin } from "@/lib/server/access";
import { handler, json } from "@/lib/server/api";
import { Organization } from "@/models/Organization";
import { Project } from "@/models/Project";
import { User } from "@/models/User";

export const GET = handler(async (_req, _ctx, session) => {
  await requireAdmin(session);
  const users = await User.find({}, { passwordHash: 0 }).sort({ createdAt: -1 }).limit(1000).lean();
  const [projectCounts, orgs] = await Promise.all([
    Project.aggregate<{ _id: unknown; n: number }>([{ $group: { _id: "$owner", n: { $sum: 1 } } }]),
    Organization.find({}, { members: 1 }).lean(),
  ]);
  const pc = new Map(projectCounts.map((p) => [String(p._id), p.n]));
  const oc = new Map<string, number>();
  for (const o of orgs) for (const m of o.members) oc.set(String(m.user), (oc.get(String(m.user)) ?? 0) + 1);
  return json({
    users: users.map((u) => ({
      _id: String(u._id),
      name: u.name,
      email: u.email,
      company: u.company ?? "",
      role: u.role ?? "user",
      createdAt: new Date(u.createdAt).toISOString(),
      projects: pc.get(String(u._id)) ?? 0,
      orgs: oc.get(String(u._id)) ?? 0,
      isMe: String(u._id) === session.userId,
    })),
  });
});
