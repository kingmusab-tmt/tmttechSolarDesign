/** Standard Test Conditions cell temperature (°C). */
export const T_STC = 25;

/** Copper resistivity at 20 °C (Ω·mm²/m). */
export const RHO_COPPER = 0.0175;

export const STD_INVERTER_W = [500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 5000, 6000, 8000, 10000, 12000, 15000, 20000, 25000, 30000];

export const STD_CONTROLLER_A = [10, 20, 30, 40, 50, 60, 80, 100, 120, 150, 200];

export const STD_BREAKER_A = [6, 10, 13, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000];

export const STD_PV_FUSE_A = [6, 8, 10, 12, 15, 16, 20, 25, 30, 32];

export const STD_SPD_UCPV = [150, 500, 600, 800, 1000, 1200, 1500];

/**
 * Copper cable cross-sections (mm²) with approximate current-carrying capacity (A)
 * for XLPE/PVC-insulated, 2 loaded conductors, ~30 °C ambient (IEC 60364-5-52, method C).
 * Indicative only: apply derating for grouping and ambient temperature on site.
 */
export const CABLE_TABLE: { size: number; ampacity: number }[] = [
  { size: 1.5, ampacity: 24 },
  { size: 2.5, ampacity: 33 },
  { size: 4, ampacity: 45 },
  { size: 6, ampacity: 58 },
  { size: 10, ampacity: 80 },
  { size: 16, ampacity: 107 },
  { size: 25, ampacity: 138 },
  { size: 35, ampacity: 171 },
  { size: 50, ampacity: 209 },
  { size: 70, ampacity: 269 },
  { size: 95, ampacity: 328 },
  { size: 120, ampacity: 382 },
  { size: 150, ampacity: 441 },
  { size: 185, ampacity: 506 },
  { size: 240, ampacity: 599 },
  { size: 300, ampacity: 693 },
];

/** Installation method factor relative to the reference method C table above (IEC 60364-5-52, XLPE, 2 loaded conductors). */
export const INSTALL_METHOD = {
  air: { factor: 1.08, label: "Free air / cable tray (method E)" },
  clipped: { factor: 1.0, label: "Clipped direct to a surface (method C)" },
  conduit: { factor: 0.89, label: "In conduit or trunking on a wall (method B)" },
  insulated: { factor: 0.78, label: "In conduit in a thermally insulated wall/roof (method A)" },
} as const;

/** Grouping factor for circuits bunched together (IEC 60364-5-52 Table B.52.17, item 1). */
export function groupingFactor(circuits: number) {
  const t: [number, number][] = [[1, 1], [2, 0.8], [3, 0.7], [4, 0.65], [5, 0.6], [6, 0.57], [7, 0.54], [8, 0.52], [9, 0.5], [12, 0.45], [16, 0.41], [20, 0.38]];
  let f = 1;
  for (const [n, k] of t) if (circuits >= n) f = k;
  return f;
}

/** Ambient temperature factor: Iz scales with √(allowed temperature rise); table basis is 30 °C ambient, 90 °C conductor. */
export function ambientFactor(ambientC: number, conductorMaxC: number) {
  return ambientC >= conductorMaxC ? 0 : Math.sqrt((conductorMaxC - ambientC) / (90 - 30));
}

export const CHEMISTRY_INFO = {
  lead_acid: { label: "Flooded lead-acid", dod: 0.5, maxChargeC: 0.15, maxDischargeC: 0.2, lifeYears: 3, cycleLife: 500 },
  gel: { label: "Gel (VRLA)", dod: 0.5, maxChargeC: 0.15, maxDischargeC: 0.2, lifeYears: 5, cycleLife: 1000 },
  agm: { label: "AGM (VRLA)", dod: 0.5, maxChargeC: 0.2, maxDischargeC: 0.25, lifeYears: 4, cycleLife: 700 },
  lifepo4: { label: "Lithium iron phosphate (LiFePO4)", dod: 0.9, maxChargeC: 0.5, maxDischargeC: 1, lifeYears: 10, cycleLife: 6000 },
} as const;

/** Smallest standard value ≥ x (or the largest if x exceeds the table). */
export function nextStd(values: number[], x: number): number {
  for (const v of values) if (v >= x - 1e-9) return v;
  return values[values.length - 1];
}

export function round(x: number, dp = 2): number {
  if (!Number.isFinite(x)) return 0;
  const f = 10 ** dp;
  return Math.round(x * f) / f;
}
