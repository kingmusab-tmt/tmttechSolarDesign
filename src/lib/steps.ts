import type { DesignResults } from "./calc";
import type { DesignInputs, StepKey } from "./schemas";

export interface StepMeta {
  key: StepKey;
  title: string;
  short: string;
  phase: "Sizing" | "Engineering" | "Deliverables";
  description: string;
}

export const STEPS: StepMeta[] = [
  { key: "site", title: "Project & Site", short: "Site", phase: "Sizing", description: "Client details, location, peak sun hours and the site's record temperatures." },
  { key: "loads", title: "Load Audit", short: "Loads", phase: "Sizing", description: "List every appliance: its power, quantity, hours of use and starting surge. Every other component is sized from this." },
  { key: "inverter", title: "Inverter Sizing", short: "Inverter", phase: "Sizing", description: "Continuous rating ≥ load + 25 %, surge rating for motor starting, and the system DC voltage." },
  { key: "battery", title: "Battery Bank", short: "Battery", phase: "Sizing", description: "Capacity for night-time use and the days of autonomy, respecting the chemistry's depth of discharge." },
  { key: "pv", title: "PV Array", short: "PV Array", phase: "Sizing", description: "The array must replace the daily energy plus system losses, based on local peak sun hours." },
  { key: "strings", title: "String Sizing", short: "Strings", phase: "Sizing", description: "Temperature-corrected Voc/Vmp so strings stay within the DC voltage limit and the MPPT window." },
  { key: "controller", title: "Charge Controller", short: "Controller", phase: "Sizing", description: "Standalone MPPT controller sizing; skipped for hybrid inverters with a built-in MPPT." },
  { key: "cables", title: "Cables & Protection", short: "Cables", phase: "Sizing", description: "Cable sizes for ≤ 3 % voltage drop, breakers, fuses, surge protection and earthing." },
  { key: "assessment", title: "Site Assessment", short: "Assessment", phase: "Engineering", description: "Shading, roof structure and orientation, and the existing electrical infrastructure." },
  { key: "layout", title: "Array Layout", short: "Layout", phase: "Engineering", description: "Roof layout of the modules with setbacks, plus the mounting hardware." },
  { key: "sld", title: "Single-Line Diagram", short: "SLD", phase: "Engineering", description: "Generated electrical schematic with every protective device and cable size." },
  { key: "compliance", title: "Code Compliance", short: "Compliance", phase: "Engineering", description: "IEC 62446 / 60364-7-712, SON, NEMSA and COREN checklist with automatic verification." },
  { key: "boq", title: "Bill of Quantities", short: "BoQ", phase: "Deliverables", description: "Complete material list and costing, down to MC4 connectors and cable ties." },
  { key: "financial", title: "Financial Model", short: "Financials", phase: "Deliverables", description: "Payback, NPV, IRR and LCOE compared with the current grid and generator spend." },
  { key: "report", title: "Design Report", short: "Report", phase: "Deliverables", description: "Printable engineering report of the complete design." },
];

export const STEP_INDEX: Record<StepKey, number> = Object.fromEntries(STEPS.map((s, i) => [s.key, i])) as Record<StepKey, number>;

export type StepStatus = "not_started" | "in_progress" | "complete";

export interface StepState {
  status: StepStatus;
  fails: number;
  warns: number;
}

/** A step is complete once the engineer marks it reviewed; in progress once its inputs exist. */
export function stepStatuses(d: DesignInputs, r: DesignResults): Record<StepKey, StepState> {
  const hasLoads = d.loads.length > 0 && r.load.dailyWh > 0;
  const started: Record<StepKey, boolean> = {
    site: Boolean(d.client.name || d.site.city),
    loads: d.loads.length > 0,
    inverter: hasLoads,
    battery: hasLoads,
    pv: hasLoads,
    strings: hasLoads,
    controller: hasLoads,
    cables: hasLoads,
    assessment: hasLoads || d.assessment.obstructions.length > 0,
    layout: hasLoads,
    sld: hasLoads,
    compliance: Object.values(d.compliance.items).some((i) => i.checked),
    boq: hasLoads,
    financial: hasLoads,
    report: hasLoads,
  };
  const out = {} as Record<StepKey, StepState>;
  for (const s of STEPS) {
    const checks = r.checks.filter((c) => c.step === s.key);
    out[s.key] = {
      status: d.progress[s.key] ? "complete" : started[s.key] ? "in_progress" : "not_started",
      fails: hasLoads ? checks.filter((c) => c.status === "fail").length : 0,
      warns: hasLoads ? checks.filter((c) => c.status === "warn").length : 0,
    };
  }
  return out;
}

export function overallProgress(states: Record<StepKey, StepState>) {
  const total = STEPS.length;
  const completed = STEPS.filter((s) => states[s.key].status === "complete").length;
  const inProgress = STEPS.filter((s) => states[s.key].status === "in_progress").length;
  // Only steps the engineer has reviewed count; in-progress steps are reported separately.
  const pct = Math.round((completed / total) * 100);
  return { total, completed, inProgress, pct };
}
