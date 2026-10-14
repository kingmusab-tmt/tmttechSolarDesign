import { requireAdmin } from "@/lib/server/access";
import { handler, json } from "@/lib/server/api";
import { ChangeRequest } from "@/models/ChangeRequest";
import { Equipment } from "@/models/Equipment";
import { Organization } from "@/models/Organization";
import { Project } from "@/models/Project";
import { User } from "@/models/User";

export const GET = handler(async (_req, _ctx, session) => {
  await requireAdmin(session);
  const [users, admins, projects, shared, orgs, library, verified, retired, userItems, pending, submissions] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: "admin" }),
    Project.countDocuments(),
    Project.countDocuments({ org: { $ne: null } }),
    Organization.countDocuments(),
    Equipment.countDocuments({ owner: null, retired: { $ne: true } }),
    Equipment.countDocuments({ owner: null, retired: { $ne: true }, verified: true }),
    Equipment.countDocuments({ owner: null, retired: true }),
    Equipment.countDocuments({ owner: { $ne: null } }),
    ChangeRequest.countDocuments({ status: "pending" }),
    Equipment.countDocuments({ owner: { $ne: null }, review: { $exists: false } }),
  ]);
  return json({ users, admins, projects, shared, orgs, library, verified, retired, userItems, pending, submissions });
});
