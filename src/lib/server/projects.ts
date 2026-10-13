import "server-only";
import { isValidObjectId } from "mongoose";
import { computeDesign } from "../calc";
import type { CollabInfo } from "../collab";
import { normalizeProject, type ProjectData } from "../schemas";
import { stepStatuses, overallProgress } from "../steps";
import { Organization } from "@/models/Organization";
import { Project } from "@/models/Project";
import { HttpError } from "./api";
import { myOrgIds, projectAccess, userNames, type ProjectAccess } from "./access";
import { connectDB } from "./db";

export async function buildCollab(access: ProjectAccess, me: { id: string; name: string }): Promise<CollabInfo> {
  const p = access.project;
  const owners = (p.sectionOwners ?? {}) as Record<string, string>;
  const names = await userNames([p.owner, ...Object.values(owners)]);
  return {
    me,
    ownerId: String(p.owner),
    ownerName: names[String(p.owner)] ?? "Owner",
    isOwner: access.isOwner,
    shared: access.shared,
    orgId: p.org ? String(p.org) : null,
    orgName: access.orgName,
    canManage: access.canManage,
    sectionOwners: Object.fromEntries(Object.entries(owners).map(([s, id]) => [s, { id, name: names[id] ?? "Team member" }])),
    sectionRev: (p.sectionRev ?? {}) as Record<string, number>,
    sectionEditedBy: (p.sectionEditedBy ?? {}) as CollabInfo["sectionEditedBy"],
  };
}

/** A project the user owns or that is shared with one of their organisations, plus its collaboration context. */
export async function getProjectForUser(me: { id: string; name: string }, id: string): Promise<{ project: ProjectData; collab: CollabInfo } | null> {
  if (!isValidObjectId(id)) return null;
  await connectDB();
  try {
    const access = await projectAccess(me.id, id);
    return { project: normalizeProject(access.project as unknown as Record<string, unknown>), collab: await buildCollab(access, me) };
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) return null;
    throw e;
  }
}

export interface ProjectSummary {
  _id: string;
  name: string;
  status: ProjectData["status"];
  clientName: string;
  city: string;
  updatedAt: string;
  progressPct: number;
  completedSteps: number;
  totalSteps: number;
  arrayKWp: number;
  inverterKW: number;
  batteryKWh: number;
  dailyKWh: number;
  capex: number;
  issues: number;
  isOwner: boolean;
  ownerName: string;
  orgName: string;
}

export function summarize(p: ProjectData, extra: Pick<ProjectSummary, "isOwner" | "ownerName" | "orgName"> = { isOwner: true, ownerName: "", orgName: "" }): ProjectSummary {
  const r = computeDesign(p);
  const statuses = stepStatuses(p, r);
  const prog = overallProgress(statuses);
  return {
    _id: p._id,
    name: p.name,
    status: p.status,
    clientName: p.client.name,
    city: p.site.city,
    updatedAt: p.updatedAt,
    progressPct: prog.pct,
    completedSteps: prog.completed,
    totalSteps: prog.total,
    arrayKWp: r.strings.arrayW / 1000,
    inverterKW: r.inverter.ratedPowerW / 1000,
    batteryKWh: r.battery.bankKWh,
    dailyKWh: r.load.dailyWh / 1000,
    capex: p.loads.length ? r.boq.grandTotal : 0,
    issues: p.loads.length ? r.checks.filter((c) => c.status === "fail").length : 0,
    ...extra,
  };
}

/** The user's own projects plus every project shared with an organisation they belong to. */
export async function listProjectSummaries(userId: string): Promise<ProjectSummary[]> {
  await connectDB();
  const orgIds = await myOrgIds(userId);
  const docs = await Project.find({ $or: [{ owner: userId }, { org: { $in: orgIds } }] })
    .sort({ updatedAt: -1 })
    .limit(300)
    .lean();
  const orgs = await Organization.find({ _id: { $in: orgIds } }, { name: 1 }).lean();
  const orgNames = Object.fromEntries(orgs.map((o) => [String(o._id), o.name]));
  const names = await userNames(docs.map((d) => d.owner));
  return docs.map((d) =>
    summarize(normalizeProject(d as unknown as Record<string, unknown>), {
      isOwner: String(d.owner) === userId,
      ownerName: names[String(d.owner)] ?? "",
      orgName: d.org ? (orgNames[String(d.org)] ?? "") : "",
    }),
  );
}
