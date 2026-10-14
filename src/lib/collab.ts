/**
 * Collaboration rules shared by the server (enforcement) and the client (UI). Pure functions only.
 */
import { SECTION_KEYS, parseSection, type SectionKey, type StepKey } from "./schemas";

/** Sections each step's form can change (locks cover all of them while someone edits the step). */
export const STEP_SECTIONS: Record<StepKey, SectionKey[]> = {
  site: ["client", "site"],
  loads: ["loads", "inverter"],
  inverter: ["inverter"],
  battery: ["battery"],
  pv: ["pv"],
  strings: ["strings", "site"],
  controller: ["controller", "inverter"],
  cables: ["cables"],
  assessment: ["assessment"],
  layout: ["layout"],
  sld: [],
  compliance: ["compliance"],
  boq: ["boq"],
  financial: ["financial"],
  handover: ["handover"],
  report: [],
};

export const SECTION_LABELS: Record<SectionKey, string> = {
  client: "Client details",
  site: "Site & climate",
  loads: "Load audit",
  inverter: "Inverter",
  battery: "Battery bank",
  pv: "PV array",
  strings: "String sizing",
  controller: "Charge controller",
  cables: "Cables & protection",
  assessment: "Site assessment",
  layout: "Array layout",
  compliance: "Compliance",
  boq: "Bill of Quantities",
  financial: "Financial model",
  handover: "Commissioning & handover",
  progress: "Progress",
};

/** Sections whose content belongs to a creator (progress ticks are review actions open to all members). */
export const OWNABLE_SECTIONS = SECTION_KEYS.filter((k) => k !== "progress");

/** Collaboration context sent to the client with a project. */
export interface CollabInfo {
  me: { id: string; name: string };
  ownerId: string;
  ownerName: string;
  isOwner: boolean;
  shared: boolean;
  orgId: string | null;
  orgName: string;
  /** Project owner or organisation owner/admin: may rename, change status, share, restore revisions. */
  canManage: boolean;
  sectionOwners: Record<string, { id: string; name: string }>;
  sectionRev: Record<string, number>;
  sectionEditedBy: Record<string, { user: string; name: string; at: string }>;
}

export interface LockInfo {
  section: string;
  userId: string;
  userName: string;
  step: string;
}

export interface PresenceInfo {
  userId: string;
  userName: string;
  step: string;
}

/** Lock lifetime; the holder renews it while actively editing. */
export const LOCK_TTL_MS = 60_000;
export const PRESENCE_TTL_MS = 30_000;

function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v as Record<string, unknown>)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

export function sameValue(a: unknown, b: unknown) {
  return stable(a) === stable(b);
}

/** True when a section still holds its untouched default value (nobody has "added info" yet). */
export function isDefaultSection(key: SectionKey, value: unknown) {
  return sameValue(parseSection(key, value), parseSection(key, undefined));
}

/**
 * Who may write a section directly. In a shared project, information belongs to whoever first
 * entered it; anyone else must propose a change for that person (or the project owner) to approve.
 */
export function sectionWriteMode(opts: { shared: boolean; section: SectionKey; ownerOfSection?: string; userId: string }): "direct" | "approval" {
  if (!opts.shared || opts.section === "progress") return "direct";
  if (!opts.ownerOfSection || opts.ownerOfSection === opts.userId) return "direct";
  return "approval";
}

export interface DiffEntry {
  path: string;
  before: unknown;
  after: unknown;
  kind: "changed" | "added" | "removed";
}

/** Field-level diff for review screens. Arrays of objects with an `id` are matched by id. */
export function diffValues(before: unknown, after: unknown, path = "", out: DiffEntry[] = [], limit = 60): DiffEntry[] {
  if (out.length >= limit) return out;
  if (sameValue(before, after)) return out;
  const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
  const byId = (arr: unknown[]) => arr.every((x) => isObj(x) && typeof x.id === "string");

  if (Array.isArray(before) && Array.isArray(after) && byId(before) && byId(after)) {
    const b = new Map(before.map((x) => [(x as { id: string }).id, x as Record<string, unknown>]));
    const a = new Map(after.map((x) => [(x as { id: string }).id, x as Record<string, unknown>]));
    const label = (x: Record<string, unknown>) => String(x.name ?? x.description ?? x.id);
    for (const [id, item] of b) if (!a.has(id) && out.length < limit) out.push({ path: `${path}[${label(item)}]`, before: item, after: undefined, kind: "removed" });
    for (const [id, item] of a) {
      if (out.length >= limit) break;
      if (!b.has(id)) out.push({ path: `${path}[${label(item)}]`, before: undefined, after: item, kind: "added" });
      else diffValues(b.get(id), item, `${path}[${label(item)}]`, out, limit);
    }
    return out;
  }
  if (isObj(before) && isObj(after)) {
    for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (out.length >= limit) break;
      diffValues(before[k], after[k], path ? `${path}.${k}` : k, out, limit);
    }
    return out;
  }
  out.push({ path: path || "(value)", before, after, kind: before === undefined ? "added" : after === undefined ? "removed" : "changed" });
  return out;
}

export function formatDiffValue(v: unknown): string {
  if (v === undefined) return "–";
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.name === "string") return `${o.name}${typeof o.watts === "number" ? ` (${o.watts} W × ${o.qty ?? 1}, ${o.hoursPerDay ?? 0} h)` : ""}`;
    const s = JSON.stringify(v);
    return s.length > 80 ? `${s.slice(0, 77)}…` : s;
  }
  return String(v);
}
