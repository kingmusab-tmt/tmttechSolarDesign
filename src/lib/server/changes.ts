import "server-only";
import { diffValues, SECTION_LABELS, type DiffEntry } from "../collab";
import type { SectionKey } from "../schemas";
import type { ChangeRequestDoc } from "@/models/ChangeRequest";
import { Equipment } from "@/models/Equipment";
import { Project } from "@/models/Project";
import { userNames } from "./access";

export interface ChangeRequestView {
  _id: string;
  kind: "section" | "equipment";
  projectId: string | null;
  projectName: string;
  section: string | null;
  sectionLabel: string;
  equipmentId: string | null;
  equipmentName: string;
  proposedBy: { id: string; name: string };
  comment: string;
  status: ChangeRequestDoc["status"];
  createdAt: string;
  reviewedBy: { id: string; name: string } | null;
  reviewComment: string;
  reviewedAt: string | null;
  diff: DiffEntry[];
  /** The target changed after the proposal was made: approving would overwrite those changes. */
  stale: boolean;
  canReview: boolean;
  canWithdraw: boolean;
}

export async function serializeChanges(docs: ChangeRequestDoc[], userId: string): Promise<ChangeRequestView[]> {
  const names = await userNames(docs.flatMap((d) => [d.proposedBy, d.reviewedBy]));
  const projectIds = [...new Set(docs.map((d) => d.project).filter(Boolean).map(String))];
  const equipmentIds = [...new Set(docs.map((d) => d.equipment).filter(Boolean).map(String))];
  const [projects, equipment] = await Promise.all([
    projectIds.length ? Project.find({ _id: { $in: projectIds } }, { name: 1, sectionRev: 1 }).lean() : [],
    equipmentIds.length ? Equipment.find({ _id: { $in: equipmentIds } }).lean() : [],
  ]);
  const pMap = new Map(projects.map((p) => [String(p._id), p]));
  const eMap = new Map(equipment.map((e) => [String(e._id), e]));

  return docs.map((d) => {
    const project = d.project ? pMap.get(String(d.project)) : undefined;
    const eq = d.equipment ? eMap.get(String(d.equipment)) : undefined;
    const pending = d.status === "pending";
    let stale = false;
    if (pending && d.kind === "section" && project && d.section) stale = ((project.sectionRev as Record<string, number> | undefined)?.[d.section] ?? 0) !== d.baseRev;
    if (pending && d.kind === "equipment" && eq) {
      const current = { brand: eq.brand, model: eq.model, specs: eq.specs, datasheetUrl: eq.datasheetUrl ?? "", notes: eq.notes ?? "" };
      stale = JSON.stringify(current) !== JSON.stringify(d.baseValue);
    }
    return {
      _id: String(d._id),
      kind: d.kind,
      projectId: d.project ? String(d.project) : null,
      projectName: project?.name ?? "",
      section: d.section,
      sectionLabel: d.section ? (SECTION_LABELS[d.section as SectionKey] ?? d.section) : "",
      equipmentId: d.equipment ? String(d.equipment) : null,
      equipmentName: eq ? `${eq.brand} ${eq.model}`.trim() : "",
      proposedBy: { id: String(d.proposedBy), name: names[String(d.proposedBy)] ?? "Team member" },
      comment: d.comment,
      status: d.status,
      createdAt: new Date(d.createdAt).toISOString(),
      reviewedBy: d.reviewedBy ? { id: String(d.reviewedBy), name: names[String(d.reviewedBy)] ?? "Team member" } : null,
      reviewComment: d.reviewComment,
      reviewedAt: d.reviewedAt ? new Date(d.reviewedAt).toISOString() : null,
      diff: diffValues(d.baseValue, d.value),
      stale,
      canReview: pending && d.approvers.some((a) => String(a) === userId) && String(d.proposedBy) !== userId,
      canWithdraw: pending && String(d.proposedBy) === userId,
    };
  });
}
