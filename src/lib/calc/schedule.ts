import type { CableResult } from "./cables";
import type { DistributionResult } from "./distribution";
import type { LayoutResult } from "./site";
import type { ControllerResult, StringResult } from "./sizing";

/*
 * Installation schedules: every cable gets a tag with its route, type, size, length and the device that
 * protects it; every string gets its modules (by row and position on the array) and its MPPT input.
 */

export interface CableRow {
  tag: string;
  from: string;
  to: string;
  type: string;
  size: string;
  lengthM: number;
  protection: string;
}

export interface StringRow {
  key: string;
  modules: number;
  positions: string; // e.g. "Row 1: modules 1–8"
  input: string; // MPPT 1, controller 2, …
  fuse: string;
  homeRun: string; // cable tag back to the isolator
}

const pad = (n: number) => String(n).padStart(2, "0");

export function computeSchedules(x: { cables: CableResult; distribution: DistributionResult; strings: StringResult; controller: ControllerResult; layout: LayoutResult; hybrid: boolean }) {
  const { cables, distribution, strings, controller, layout } = x;
  const seg = (k: string) => cables.segments.find((s) => s.key === k);
  const rows: CableRow[] = [];
  let dc = 0;
  let ac = 0;
  const inputName = controller.applicable ? "Charge controller" : "Inverter MPPT";
  const mppts = Math.max(1, Math.min(strings.device.mpptCount, strings.parallel));
  const inputOf = (i: number) => {
    const n = Math.floor(i / Math.max(1, strings.stringsPerMppt)) + 1;
    return controller.applicable && controller.count > 1 ? `Controller ${Math.min(controller.count, n)}` : `${inputName} ${Math.min(mppts, n)}`;
  };

  // DC: one pair per string to the combiner / isolator, then one pair per input to the converter.
  const s1 = seg("pv_string");
  const stringTags: string[] = [];
  if (s1)
    for (let i = 0; i < strings.parallel; i++) {
      const tag = `DC-${pad(++dc)}`;
      stringTags.push(tag);
      rows.push({ tag, from: `String S${i + 1} (+/−)`, to: cables.stringFuseA ? "String fuse box" : "DC isolator", type: "PV1-F / EN 50618, red + black", size: `2 × 1 × ${s1.sizeMm2} mm²`, lengthM: s1.lengthM, protection: cables.stringFuseA ? `${cables.stringFuseA} A gPV fuse (+ and −)` : "–" });
    }
  const s2 = seg("pv_array");
  if (s2)
    for (let m = 0; m < s2.runs; m++)
      rows.push({ tag: `DC-${pad(++dc)}`, from: `DC isolator ${s2.runs > 1 ? m + 1 : ""}`.trim(), to: controller.applicable ? `Charge controller ${controller.count > 1 ? m + 1 : ""}`.trim() : `Inverter PV input ${m + 1}`, type: "PV1-F / EN 50618, red + black", size: `2 × 1 × ${s2.sizeMm2} mm²`, lengthM: s2.lengthM, protection: s2.protectionLabel });
  const s3 = seg("ctrl_batt");
  if (s3)
    for (let c = 0; c < s3.runs; c++)
      rows.push({ tag: `DC-${pad(++dc)}`, from: `Charge controller ${s3.runs > 1 ? c + 1 : ""}`.trim(), to: "Battery bus", type: "Flexible Cu, H07RN-F / welding cable, red + black", size: `2 × 1 × ${s3.sizeMm2} mm²`, lengthM: s3.lengthM, protection: s3.protectionLabel });
  const s4 = seg("batt_inv");
  if (s4) rows.push({ tag: `DC-${pad(++dc)}`, from: "Battery bank (via fuse + isolator)", to: "Inverter DC input", type: "Flexible Cu, H07RN-F / welding cable, red + black", size: `2 × 1 × ${s4.sizeMm2} mm²`, lengthM: s4.lengthM, protection: s4.protectionLabel });

  // AC: inverter output, grid input and every final circuit.
  const s5 = seg("ac_out");
  if (s5) rows.push({ tag: `AC-${pad(++ac)}`, from: "Inverter AC output", to: "Essential-loads board", type: "3-core Cu, PVC/XLPE (L, N, PE)", size: `3 × ${s5.sizeMm2} mm²`, lengthM: s5.lengthM, protection: s5.protectionLabel });
  const s6 = seg("ac_in");
  if (s6) rows.push({ tag: `AC-${pad(++ac)}`, from: "Grid / generator (main board)", to: "Inverter AC input", type: "3-core Cu, PVC/XLPE (L, N, PE)", size: `3 × ${s6.sizeMm2} mm²`, lengthM: s6.lengthM, protection: s6.protectionLabel });
  for (const c of distribution.circuits)
    rows.push({ tag: `AC-${pad(++ac)}`, from: `Essential-loads board, way ${c.ref}`, to: c.name, type: "3-core Cu, PVC/XLPE (L, N, PE)", size: `3 × ${c.cableMm2} mm²`, lengthM: 0, protection: c.protection });

  // Earthing and bonding.
  rows.push({ tag: "E-01", from: "Main earth terminal", to: "Earth electrode", type: "Green/yellow Cu", size: `1 × ${cables.earthing.mainEarthMm2} mm²`, lengthM: 0, protection: "–" });
  rows.push({ tag: "E-02", from: "Array frames and rails", to: "Main earth terminal", type: "Green/yellow Cu", size: `1 × ${cables.earthing.bondingMm2} mm²`, lengthM: 0, protection: "–" });
  rows.push({ tag: "E-03", from: "Inverter, battery rack, SPDs", to: "Main earth terminal", type: "Green/yellow Cu", size: `1 × ${cables.earthing.bondingMm2} mm²`, lengthM: 0, protection: "–" });

  // Strings: which modules (row / position on the array) and which input.
  const stringRows: StringRow[] = [];
  for (let i = 0; i < strings.parallel; i++) {
    const mods = layout.placed.filter((p) => p.string === i);
    const byRow = new Map<number, number[]>();
    for (const p of mods) {
      const col = Math.round((p.x - (layout.placed[0]?.x ?? 0)) / Math.max(0.01, layout.moduleW)) + 1;
      byRow.set(p.row, [...(byRow.get(p.row) ?? []), col]);
    }
    const positions = [...byRow]
      .map(([r, cols]) => {
        const sorted = cols.sort((a, b) => a - b);
        return `Row ${r + 1}: ${sorted.length > 1 ? `modules ${sorted[0]}–${sorted[sorted.length - 1]}` : `module ${sorted[0]}`}`;
      })
      .join("; ");
    stringRows.push({
      key: `S${i + 1}`,
      modules: strings.series,
      positions: positions || "Not placed (does not fit the area)",
      input: inputOf(i),
      fuse: cables.stringFuseA ? `${cables.stringFuseA} A gPV, + and −` : "Not required",
      homeRun: stringTags[i] ?? "–",
    });
  }
  return { cables: rows, strings: stringRows };
}

export type Schedules = ReturnType<typeof computeSchedules>;
