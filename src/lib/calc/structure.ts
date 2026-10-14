import type { Assessment, LayoutSettings, PanelSpec } from "../schemas";
import { round } from "./constants";
import { isRacked, type LayoutResult, type MountType } from "./site";
import { check, type Check } from "./types";

/*
 * Mounting structure and a simplified wind-uplift check (after EN 1991-1-4):
 *   qp = ½ · ρ · vb² · ce(z)      peak velocity pressure
 *   Fw = qp · cp,net · A          uplift on the array
 * It sizes attachments, ballast and footings for a first design. Racking suppliers and a structural
 * engineer must still confirm the fixings, roof members and foundations.
 */

const RHO_AIR = 1.25; // kg/m³
const GAMMA = 1.5; // partial safety factor on wind uplift
const G = 9.81;
const FRAME_SPACING_M = 1.8; // tilt frames along a row
const CONCRETE_KG_M3 = 2400;
const FOOTING_SIDE_M = 0.3;

/** Exposure factor ce(z) and net uplift coefficient by mounting (terrain category II, typical heights). */
const WIND: Record<MountType, { ce: number; cpNet: number; label: string }> = {
  gable: { ce: 2.0, cpNet: 1.0, label: "flush on a pitched roof" }, // gap under modules relieves part of the uplift
  shed: { ce: 2.0, cpNet: 1.0, label: "flush on a mono-pitch roof" },
  flat: { ce: 2.1, cpNet: 1.5, label: "tilt frames on a flat roof" },
  ground: { ce: 1.6, cpNet: 1.4, label: "free-standing ground frames" },
};

export interface StructureResult {
  mount: MountType;
  racked: boolean;
  tiltDeg: number;
  /** Tilted rows: distance from one row's front edge to the next, shade-free at the lowest noon sun. */
  rowPitchM: number;
  depthNeededM: number;
  fitsDepth: boolean;
  frames: number;
  posts: number;
  footings: number;
  footingDepthM: number;
  concreteM3: number;
  anchors: number; // roof hooks/L-feet (pitched) or chemical anchors (anchored flat roof)
  ballastKg: number;
  ballastBlocks: number;
  windPressureKPa: number;
  upliftKN: number;
  designUpliftPerFixingKN: number;
  fixingCapacityKN: number;
  totalDeadLoadKgM2: number;
  checks: Check[];
}

export function computeStructure(x: { assess: Assessment; settings: LayoutSettings; layout: LayoutResult; panel: PanelSpec; totalPanels: number; mount: MountType; recommendedTiltDeg: number; minNoonAltitudeDeg: number }): StructureResult {
  const { assess, settings, layout, panel, totalPanels, mount } = x;
  const racked = isRacked(mount);
  const tiltDeg = racked ? Math.max(5, Math.min(60, x.recommendedTiltDeg)) : assess.roofPitchDeg;
  const beta = (tiltDeg * Math.PI) / 180;
  const h = layout.moduleH;
  const rows = Math.max(1, layout.rowsUsed);

  // Inter-row spacing so the row in front never shades the next at the lowest noon sun of the year.
  const alt = (Math.max(10, x.minNoonAltitudeDeg) * Math.PI) / 180;
  const shadeGap = (h * Math.sin(beta)) / Math.tan(alt);
  const rowPitchM = racked ? h * Math.cos(beta) + Math.max(settings.rowGapM, shadeGap) : h + settings.rowGapM;
  const depthNeededM = racked ? 2 * settings.setbackM + (rows - 1) * rowPitchM + h * Math.cos(beta) : 2 * settings.setbackM + rows * h + (rows - 1) * settings.rowGapM;
  const fitsDepth = depthNeededM <= assess.roofWidthM + 1e-6;

  // Frames every ~1.8 m along each row (racked mounts only).
  const frames = racked ? layout.rowLengths.reduce((a, l) => a + Math.ceil(l / FRAME_SPACING_M - 1e-9) + 1, 0) : 0;

  // Wind uplift on the whole array.
  const w = WIND[mount];
  const area = totalPanels * panel.lengthM * panel.widthM;
  const qp = 0.5 * RHO_AIR * assess.windSpeedMs ** 2 * w.ce; // Pa
  const upliftKN = (qp * w.cpNet * area) / 1000;
  const designKN = GAMMA * upliftKN;
  const arrayKg = totalPanels * panel.weightKg + assess.mountingWeightKgM2 * area;

  let anchors = 0;
  let posts = 0;
  let ballastKg = 0;
  let footingDepthM = 0;
  let perFixing = 0;
  let capacity = assess.attachmentCapacityKN;
  const checks: Check[] = [];

  if (mount === "ground") {
    posts = frames * 2;
    // Each post's footing must hold its share of the factored uplift by its own weight.
    perFixing = posts ? designKN / posts : 0;
    const needKg = (perFixing * 1000) / G;
    footingDepthM = Math.max(0.6, Math.ceil((needKg / (CONCRETE_KG_M3 * FOOTING_SIDE_M ** 2)) * 20 - 1e-9) / 20);
    capacity = (CONCRETE_KG_M3 * FOOTING_SIDE_M ** 2 * footingDepthM * G) / 1000;
    checks.push(check("layout", "st-footing", "Footings resist wind uplift", capacity >= perFixing - 1e-9, `${posts} posts, ${FOOTING_SIDE_M * 1000} × ${FOOTING_SIDE_M * 1000} mm concrete footings ${round(footingDepthM, 2)} m deep hold ${round(capacity, 2)} kN each vs ${round(perFixing, 2)} kN factored uplift`));
  } else if (mount === "flat" && settings.flatFixing === "ballast") {
    // Ballast must outweigh the factored uplift (less the array's own weight).
    ballastKg = Math.max(0, (designKN * 1000) / G - arrayKg);
    perFixing = 0;
  } else {
    // Roof hooks / L-feet (pitched) or chemical anchors (anchored flat roof).
    anchors = mount === "flat" ? frames * 2 : layout.roofAttachments;
    perFixing = anchors ? designKN / anchors : 0;
    const needed = Math.ceil(designKN / Math.max(0.01, capacity) - 1e-9);
    checks.push(
      check(
        "layout",
        "st-fixings",
        "Roof fixings resist wind uplift",
        perFixing <= capacity + 1e-9,
        `${anchors} ${mount === "flat" ? "anchors" : "roof attachments"} take ${round(perFixing, 2)} kN each (factored) vs ${capacity} kN capacity${perFixing > capacity ? `: use at least ${needed} or stronger fixings` : ""}`,
      ),
    );
  }

  const footprint = racked ? Math.max(area * Math.cos(beta), 0.01) : Math.max(area, 0.01);
  const totalDeadLoadKgM2 = mount === "ground" ? 0 : (arrayKg + ballastKg) / footprint;
  if (mount === "flat")
    checks.push(check("layout", "st-roof-load", "Roof carries the array and ballast", totalDeadLoadKgM2 <= assess.roofAllowableLoadKgM2 + 1e-6, `${round(totalDeadLoadKgM2, 1)} kg/m² (array ${round(arrayKg, 0)} kg${ballastKg ? ` + ballast ${round(ballastKg, 0)} kg` : ""}) vs ${assess.roofAllowableLoadKgM2} kg/m² allowable`));
  if (racked)
    checks.push(check("layout", "st-depth", "Tilted rows fit without shading each other", fitsDepth, `${rows} row(s) at ${round(rowPitchM, 2)} m pitch need ${round(depthNeededM, 1)} m; ${round(assess.roofWidthM, 1)} m available`));

  checks.push(check("layout", "st-wind", "Wind load assessed", assess.windSpeedMs > 0, `${w.label}: qp ${round(qp / 1000, 2)} kPa (vb ${assess.windSpeedMs} m/s), uplift ${round(upliftKN, 1)} kN, factored ${round(designKN, 1)} kN. Confirm fixings with the racking supplier.`, "warn"));

  return {
    mount,
    racked,
    tiltDeg,
    rowPitchM,
    depthNeededM,
    fitsDepth,
    frames,
    posts,
    footings: posts,
    footingDepthM,
    concreteM3: posts * FOOTING_SIDE_M ** 2 * footingDepthM,
    anchors,
    ballastKg,
    ballastBlocks: Math.ceil(ballastKg / 25 - 1e-9),
    windPressureKPa: qp / 1000,
    upliftKN,
    designUpliftPerFixingKN: perFixing,
    fixingCapacityKN: capacity,
    totalDeadLoadKgM2,
    checks,
  };
}
