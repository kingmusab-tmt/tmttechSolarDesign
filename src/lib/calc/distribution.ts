import type { CableSettings, LoadItem } from "../schemas";
import { INSTALL_METHOD, ambientFactor, nextStd, round } from "./constants";
import { selectCable } from "./cables";
import { check, type Check } from "./types";

/*
 * Essential-loads distribution board fed by the inverter: groups the load audit into final circuits
 * (IEC 60364-5-52 / 4-41). Lighting on 1.5 mm² B-curve circuits, general appliances on 2.5 mm²
 * radial circuits, and heavy or motor loads on their own circuit. Every final circuit gets 30 mA RCD
 * protection (RCBO).
 */

const MCB_A = [6, 10, 16, 20, 25, 32, 40, 50, 63];
const DB_SIZES = [4, 6, 8, 12, 16, 18, 24, 36];
const LIGHTING_MAX_W = 1000; // per lighting circuit (≈ 4.3 A on a 10 A breaker)
const GENERAL_MAX_W = 2500; // per 20 A radial circuit, connected load
const DEDICATED_W = 1000; // single appliances at or above this get their own circuit

export interface FinalCircuit {
  ref: string; // C1, C2…
  name: string;
  kind: "lighting" | "general" | "dedicated";
  loads: string[];
  connectedW: number;
  designA: number;
  mcbA: number;
  curve: "B" | "C";
  protection: string;
  cableMm2: number;
  dropPct: number;
  ampacityA: number;
}

export interface DistributionResult {
  circuits: FinalCircuit[];
  waysUsed: number;
  boardWays: number;
  connectedW: number;
  checks: Check[];
}

export function computeDistribution(x: { loads: LoadItem[]; cables: CableSettings; siteMaxC: number }): DistributionResult {
  const V = x.cables.acVoltage;
  const len = x.cables.finalCircuitLengthM;
  const indoorC = x.cables.indoorAmbientC > 0 ? x.cables.indoorAmbientC : Math.max(30, x.siteMaxC);
  // Final circuits run in groups in the board and ceiling: assume 3 grouped (Cg 0.7).
  const derate = ambientFactor(indoorC, 90) * 0.7 * INSTALL_METHOD[x.cables.installMethod].factor;
  const items = x.loads.filter((l) => l.watts > 0 && l.qty > 0);

  const lighting = items.filter((l) => /light/i.test(l.category) && l.watts < DEDICATED_W);
  const dedicated = items.filter((l) => !lighting.includes(l) && (l.watts >= DEDICATED_W || (l.inductive && l.watts >= 750)));
  const general = items.filter((l) => !lighting.includes(l) && !dedicated.includes(l));

  const groups: { name: string; kind: FinalCircuit["kind"]; parts: { label: string; w: number; inductive: boolean }[] }[] = [];
  /** Bin items into circuits up to a power limit (first fit, largest first). */
  const pack = (list: LoadItem[], maxW: number, kind: FinalCircuit["kind"], name: string) => {
    const bins: { label: string; w: number; inductive: boolean }[][] = [];
    const parts = list.flatMap((l) => Array.from({ length: Math.ceil(l.qty) }, () => ({ label: l.name, w: l.watts, inductive: l.inductive }))).sort((a, b) => b.w - a.w);
    for (const p of parts) {
      const bin = bins.find((b) => b.reduce((a, q) => a + q.w, 0) + p.w <= maxW);
      if (bin) bin.push(p);
      else bins.push([p]);
    }
    bins.forEach((b, i) => groups.push({ name: bins.length > 1 ? `${name} ${i + 1}` : name, kind, parts: b }));
  };
  pack(lighting, LIGHTING_MAX_W, "lighting", "Lighting");
  pack(general, GENERAL_MAX_W, "general", "Sockets / appliances");
  for (const l of dedicated) for (let i = 0; i < Math.ceil(l.qty); i++) groups.push({ name: `${l.name}${l.qty > 1 ? ` ${i + 1}` : ""} (dedicated)`, kind: "dedicated", parts: [{ label: l.name, w: l.watts, inductive: l.inductive }] });

  const circuits: FinalCircuit[] = groups.map((g, i) => {
    const w = g.parts.reduce((a, p) => a + p.w, 0);
    const inductive = g.parts.some((p) => p.inductive);
    const designA = w / (V * (inductive ? 0.85 : 1));
    const minMcb = g.kind === "lighting" ? 6 : g.kind === "general" ? 20 : 16;
    const mcbA = nextStd(MCB_A, Math.max(minMcb, designA * 1.25));
    const minCable = g.kind === "lighting" ? 1.5 : 2.5;
    const sel = selectCable(len, designA, mcbA, V, x.cables.acDropPct, minCable, derate);
    // label the distinct appliances on the circuit
    const counts = new Map<string, number>();
    for (const p of g.parts) counts.set(p.label, (counts.get(p.label) ?? 0) + 1);
    return {
      ref: `C${i + 1}`,
      name: g.name,
      kind: g.kind,
      loads: [...counts].map(([l, c]) => (c > 1 ? `${c} × ${l}` : l)),
      connectedW: w,
      designA,
      mcbA,
      curve: inductive ? "C" : "B",
      protection: `${mcbA} A ${inductive ? "C" : "B"}-curve RCBO, 30 mA Type A`,
      cableMm2: sel.sizeMm2,
      dropPct: sel.dropPct,
      ampacityA: sel.ampacityA,
    };
  });

  // Ways: final circuits + double-pole main switch + SPD (2 modules each).
  const waysUsed = circuits.length + 4;
  const boardWays = nextStd(DB_SIZES, Math.ceil(waysUsed * 1.25)); // 25 % spare for future circuits
  const connectedW = circuits.reduce((a, c) => a + c.connectedW, 0);

  const checks: Check[] = [
    check("sld", "db-circuits", "Every load is on a protected final circuit", circuits.length > 0 || items.length === 0, `${circuits.length} final circuits, each with 30 mA RCD protection (IEC 60364-4-41)`),
    check("sld", "db-cables", "Final circuit cables carry their breaker rating (Iz ≥ In)", circuits.every((c) => c.ampacityA >= c.mcbA - 1e-6), circuits.filter((c) => c.ampacityA < c.mcbA).map((c) => `${c.ref} ${c.cableMm2} mm² ${round(c.ampacityA, 1)} A < ${c.mcbA} A`).join("; ") || `Assumed ${len} m runs, grouped`),
    check("sld", "db-drop", `Final circuit voltage drop ≤ ${x.cables.acDropPct} %`, circuits.every((c) => c.dropPct <= x.cables.acDropPct + 1e-6), circuits.length ? `Worst ${round(Math.max(...circuits.map((c) => c.dropPct)), 2)} % over ${len} m` : "No circuits", "warn"),
  ];
  return { circuits, waysUsed, boardWays, connectedW, checks };
}
