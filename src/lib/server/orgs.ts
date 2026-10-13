import "server-only";
import { isValidObjectId } from "mongoose";
import { Organization, OrgInvite, type OrganizationDoc, type OrgRole } from "@/models/Organization";
import { User } from "@/models/User";
import { HttpError } from "./api";
import { orgRoleOf } from "./access";

export interface OrgView {
  _id: string;
  name: string;
  myRole: OrgRole;
  members: { userId: string; name: string; email: string; role: OrgRole; joinedAt: string }[];
  invites: { _id: string; email: string; role: string; createdAt: string }[];
}

export async function loadOrgForRole(orgId: string, userId: string, roles: OrgRole[]) {
  if (!isValidObjectId(orgId)) throw new HttpError(404, "Organisation not found");
  const org = await Organization.findById(orgId).lean<OrganizationDoc>();
  const role = org ? orgRoleOf(org, userId) : null;
  if (!org || !role) throw new HttpError(404, "Organisation not found");
  if (!roles.includes(role)) throw new HttpError(403, "You need to be an organisation owner or admin to do that");
  return { org, role };
}

export async function viewOrgs(orgs: OrganizationDoc[], userId: string): Promise<OrgView[]> {
  const ids = orgs.flatMap((o) => o.members.map((m) => m.user));
  const users = await User.find({ _id: { $in: ids } }, { name: 1, email: 1 }).lean();
  const uMap = new Map(users.map((u) => [String(u._id), u]));
  const invites = await OrgInvite.find({ org: { $in: orgs.map((o) => o._id) }, status: "pending" }).lean();
  return orgs.map((o) => {
    const myRole = orgRoleOf(o, userId)!;
    const canSeeInvites = myRole === "owner" || myRole === "admin";
    return {
      _id: String(o._id),
      name: o.name,
      myRole,
      members: o.members.map((m) => ({
        userId: String(m.user),
        name: uMap.get(String(m.user))?.name ?? "Former user",
        email: uMap.get(String(m.user))?.email ?? "",
        role: m.role,
        joinedAt: new Date(m.joinedAt).toISOString(),
      })),
      invites: canSeeInvites
        ? invites.filter((i) => String(i.org) === String(o._id)).map((i) => ({ _id: String(i._id), email: i.email, role: i.role, createdAt: new Date(i.createdAt).toISOString() }))
        : [],
    };
  });
}
