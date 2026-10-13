import "server-only";
import { isValidObjectId, Types } from "mongoose";
import { Organization, type OrgRole } from "@/models/Organization";
import { Project, type ProjectDoc } from "@/models/Project";
import { User, type UserDoc } from "@/models/User";
import { HttpError } from "./api";
import type { Session } from "./auth";

/** Emails listed in ADMIN_EMAILS (comma-separated) become admins when they sign in. */
export function isBootstrapAdmin(email: string) {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

export async function loadUser(session: Session): Promise<UserDoc> {
  const user = await User.findById(session.userId).lean<UserDoc>();
  if (!user) throw new HttpError(401, "Account no longer exists");
  return user;
}

export async function requireAdmin(session: Session): Promise<UserDoc> {
  const user = await loadUser(session);
  if (user.role !== "admin") throw new HttpError(403, "Administrator access required");
  return user;
}

export async function myOrgs(userId: string) {
  return Organization.find({ "members.user": userId }).lean();
}

export async function myOrgIds(userId: string): Promise<Types.ObjectId[]> {
  const orgs = await Organization.find({ "members.user": userId }, { _id: 1 }).lean();
  return orgs.map((o) => o._id);
}

export function orgRoleOf(org: { members: { user: Types.ObjectId; role: OrgRole }[] }, userId: string): OrgRole | null {
  return org.members.find((m) => String(m.user) === userId)?.role ?? null;
}

export interface ProjectAccess {
  project: ProjectDoc;
  userId: string;
  isOwner: boolean;
  shared: boolean;
  orgRole: OrgRole | null;
  orgName: string;
  /** Project owner, or owner/admin of the organisation it is shared with. */
  canManage: boolean;
}

/** Load a project the user may access (own, or shared with one of their organisations). */
export async function projectAccess(userId: string, projectId: string): Promise<ProjectAccess> {
  if (!isValidObjectId(projectId)) throw new HttpError(404, "Project not found");
  const project = await Project.findById(projectId).lean<ProjectDoc>();
  if (!project) throw new HttpError(404, "Project not found");
  const isOwner = String(project.owner) === userId;
  let orgRole: OrgRole | null = null;
  let orgName = "";
  if (project.org) {
    const org = await Organization.findById(project.org).lean();
    if (org) {
      orgRole = orgRoleOf(org, userId);
      orgName = org.name;
    }
  }
  if (!isOwner && !orgRole) throw new HttpError(404, "Project not found");
  return {
    project,
    userId,
    isOwner,
    shared: Boolean(project.org),
    orgRole,
    orgName,
    canManage: isOwner || orgRole === "owner" || orgRole === "admin",
  };
}

/** Map of user id → display name for the given ids. */
export async function userNames(ids: (string | Types.ObjectId | null | undefined)[]) {
  const uniq = [...new Set(ids.filter(Boolean).map(String))].filter((id) => isValidObjectId(id));
  if (!uniq.length) return {} as Record<string, string>;
  const users = await User.find({ _id: { $in: uniq } }, { name: 1 }).lean();
  return Object.fromEntries(users.map((u) => [String(u._id), u.name])) as Record<string, string>;
}
