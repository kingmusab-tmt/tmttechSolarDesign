import type { Assessment, LayoutSettings, PanelSpec, Site } from "../schemas";
import { round } from "./constants";
import { check, type Check } from "./types";

/* ------------------------------------------------------------------ */
/* Step 10 — Array layout (computed first: the site checks use it)     */
/* ------------------------------------------------------------------ */

export interface PlacedPanel {
  x: number;
  y: number;
  w: number;
  h: number;
  string: number; // 0-based string index
  row: number;
}

export interface LayoutResult {
  moduleW: number; // along the eave
  moduleH: number; // up the slope
  cols: number;
  rows: number;
  capacity: number;
  placed: PlacedPanel[];
  fits: boolean;
  rowsUsed: number;
  rowLengths: number[]; // metres of rail run per used row
  railLengthM: number;
  railPieces: number; // 4.2 m rails
  railSplices: number;
  midClamps: number;
  endClamps: number;
  roofAttachments: number;
  arrayAreaM2: number;
}

const RAIL_PIECE_M = 4.2;
const ATTACHMENT_SPACING_M = 1.2;

export function computeLayout(assess: Assessment, layout: LayoutSettings, panel: PanelSpec, totalPanels: number, series: number): LayoutResult {
  const portrait = layout.orientation === "portrait";
  const moduleW = portrait ? panel.widthM : panel.lengthM;
  const moduleH = portrait ? panel.lengthM : panel.widthM;
  const usableW = assess.roofLengthM - 2 * layout.setbackM;
  const usableH = assess.roofWidthM - 2 * layout.setbackM;
  const cols = usableW >= moduleW ? Math.floor((usableW + layout.gapM) / (moduleW + layout.gapM) + 1e-9) : 0;
  const rows = usableH >= moduleH ? Math.floor((usableH + layout.rowGapM) / (moduleH + layout.rowGapM) + 1e-9) : 0;
  const capacity = cols * rows;
  const n = Math.min(capacity, totalPanels);

  const placed: PlacedPanel[] = [];
  const rowCounts: number[] = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    rowCounts[r] = (rowCounts[r] ?? 0) + 1;
    placed.push({
      x: layout.setbackM + c * (moduleW + layout.gapM),
      y: layout.setbackM + r * (moduleH + layout.rowGapM),
      w: moduleW,
      h: moduleH,
      string: series > 0 ? Math.floor(i / series) : 0,
      row: r,
    });
  }
  const rowLengths = rowCounts.map((k) => k * moduleW + (k - 1) * layout.gapM);
  const railLengthM = rowLengths.reduce((a, l) => a + 2 * l, 0);
  const piecesPerRow = rowLengths.map((l) => Math.ceil(l / RAIL_PIECE_M - 1e-9));
  const railPieces = piecesPerRow.reduce((a, p) => a + 2 * p, 0);
  const railSplices = piecesPerRow.reduce((a, p) => a + 2 * Math.max(0, p - 1), 0);
  const midClamps = rowCounts.reduce((a, k) => a + 2 * Math.max(0, k - 1), 0);
  const endClamps = rowCounts.length * 4;
  const roofAttachments = rowLengths.reduce((a, l) => a + 2 * (Math.ceil(l / ATTACHMENT_SPACING_M - 1e-9) + 1), 0);

  return {
    moduleW,
    moduleH,
    cols,
    rows,
    capacity,
    placed,
    fits: capacity >= totalPanels,
    rowsUsed: rowCounts.length,
    rowLengths,
    railLengthM,
    railPieces,
    railSplices,
    midClamps,
    endClamps,
    roofAttachments,
    arrayAreaM2: totalPanels * panel.lengthM * panel.widthM,
  };
}

/* ------------------------------------------------------------------ */
/* Step 1 & 9 — Site & assessment                                      */
/* ------------------------------------------------------------------ */

const DIR_DEG: Record<string, number> = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };

export interface ObstructionResult {
  id: string;
  description: string;
  direction: string;
  elevationDeg: number;
  inSunPath: boolean;
  severity: "none" | "low" | "high";
}

export interface SiteResult {
  recommendedTiltDeg: number;
  recommendedAzimuthDeg: number;
  azimuthDeviationDeg: number;
  minNoonAltitudeDeg: number;
  obstructions: ObstructionResult[];
  arrayWeightKg: number;
  deadLoadKgM2: number;
  maxBackfeedA: number;
  checks: Check[];
}

export type MountType = "flat" | "ground" | "gable" | "shed";

/** The mounting actually used: the engineer's choice, or one inferred from the site assessment. */
export function resolveMount(assess: Assessment, layout: Pick<LayoutSettings, "mountType">): MountType {
  if (layout.mountType && layout.mountType !== "auto") return layout.mountType;
  if (assess.roofType === "ground") return "ground";
  return assess.roofPitchDeg < 5 ? "flat" : "gable";
}

/** Flat roofs and ground mounts use tilted racks facing the equator, independent of the roof plane. */
export const isRacked = (m: MountType) => m === "flat" || m === "ground";

export function computeSite(site: Site, assess: Assessment, layout: LayoutResult, panel: PanelSpec, totalPanels: number, acBreakerA: number, mount: MountType = resolveMount(assess, { mountType: "auto" })): SiteResult {
  const racked = isRacked(mount);
  const lat = site.latitude;
  const recommendedTiltDeg = Math.max(10, Math.round(Math.abs(lat)));
  const recommendedAzimuthDeg = lat >= 0 ? 180 : 0; // face the equator
  let dev = Math.abs(assess.roofAzimuthDeg - recommendedAzimuthDeg) % 360;
  if (dev > 180) dev = 360 - dev;
  const minNoonAltitudeDeg = 90 - Math.abs(lat) - 23.45;

  // In the tropics the sun passes through the eastern, southern, western and (in mid-year) northern sky.
  const sunPathDirs = Math.abs(lat) < 23.45 ? ["NE", "E", "SE", "S", "SW", "W", "NW", "N"] : lat >= 0 ? ["E", "SE", "S", "SW", "W"] : ["E", "NE", "N", "NW", "W"];
  const obstructions = assess.obstructions.map((o) => {
    const elevationDeg = (Math.atan2(o.heightM, o.distanceM) * 180) / Math.PI;
    const facingEquator = Math.abs((((DIR_DEG[o.direction] - recommendedAzimuthDeg) % 360) + 540) % 360 - 180) <= 90;
    const inSunPath = sunPathDirs.includes(o.direction);
    const threshold = facingEquator ? 15 : 25;
    const severity: ObstructionResult["severity"] = !inSunPath || elevationDeg <= threshold * 0.66 ? "none" : elevationDeg <= threshold ? "low" : "high";
    return { id: o.id, description: o.description, direction: o.direction, elevationDeg, inSunPath, severity };
  });

  const arrayWeightKg = totalPanels * panel.weightKg + assess.mountingWeightKgM2 * layout.arrayAreaM2;
  const deadLoadKgM2 = layout.arrayAreaM2 > 0 ? arrayWeightKg / layout.arrayAreaM2 : 0;
  const maxBackfeedA = assess.busbarRatingA * 1.2 - assess.mainBreakerA;

  const checks: Check[] = [
    check("site", "site-psh", "Peak sun hours defined", site.peakSunHours > 0, `${site.peakSunHours} kWh/m²/day at ${site.city || "site"}`),
    check("site", "site-temps", "Design temperatures defined", site.tMax > site.tMin, `Record low ${site.tMin} °C, record high ${site.tMax} °C`),
    check("assessment", "as-orientation", "Roof faces the equator (±45°)", dev <= 45 || assess.roofType === "ground" || racked, `Roof azimuth ${assess.roofAzimuthDeg}° vs ideal ${recommendedAzimuthDeg}° (deviation ${round(dev, 0)}°)`, "warn"),
    check("assessment", "as-tilt", "Tilt allows self-cleaning (≥ 10°)", assess.roofPitchDeg >= 10 || assess.roofType === "ground" || racked, racked ? `Tilt frames at ${recommendedTiltDeg}° facing ${recommendedAzimuthDeg}° (${mount === "ground" ? "ground mount" : "flat roof"})` : `Roof pitch ${assess.roofPitchDeg}° (recommended ≈ ${recommendedTiltDeg}°); flatter roofs need tilt frames`, "warn"),
    check("assessment", "as-shading", "No significant shading obstructions", obstructions.every((o) => o.severity !== "high"), obstructions.length ? obstructions.map((o) => `${o.description} ${o.direction} ${round(o.elevationDeg, 0)}°`).join("; ") : "No obstructions recorded", "warn"),
    check("assessment", "as-structure", "Roof can carry the array dead load", racked || deadLoadKgM2 <= assess.roofAllowableLoadKgM2 + 1e-6, racked ? (mount === "ground" ? "Ground mount: no roof load" : "Checked with ballast under Array layout") : `${round(deadLoadKgM2, 1)} kg/m² (${round(arrayWeightKg, 0)} kg in total) vs ${assess.roofAllowableLoadKgM2} kg/m² allowable`),
    check("assessment", "as-condition", "Roof condition acceptable", assess.roofCondition !== "poor", `Roof condition: ${assess.roofCondition}${assess.roofType === "asbestos" ? " (asbestos roof: do not drill; use a ground mount)" : ""}`, "warn"),
    check("assessment", "as-spare", "Spare ways in the distribution board", assess.spareWays >= (site.gridAvailable ? 2 : 1), `${assess.spareWays} spare way(s) available`, "warn"),
  ];
  if (site.gridAvailable)
    checks.push(check("assessment", "as-busbar", "Busbar 120 % rule", acBreakerA <= maxBackfeedA, `Inverter breaker ${acBreakerA} A vs allowable ${round(maxBackfeedA, 0)} A (1.2 × ${assess.busbarRatingA} A − ${assess.mainBreakerA} A main)`, "warn"));
  if (assess.earthResistanceOhm > 0)
    checks.push(check("assessment", "as-earth", "Earth electrode resistance ≤ 10 Ω", assess.earthResistanceOhm <= 10, `Measured ${assess.earthResistanceOhm} Ω`));
  checks.push(check("layout", "lay-fit", "All modules fit on the roof", layout.fits, `${layout.capacity} module positions (${layout.cols} × ${layout.rows}) for ${totalPanels} modules`));

  return { recommendedTiltDeg, recommendedAzimuthDeg, azimuthDeviationDeg: dev, minNoonAltitudeDeg, obstructions, arrayWeightKg, deadLoadKgM2, maxBackfeedA, checks };
}
