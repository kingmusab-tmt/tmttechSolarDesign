import type { Assessment, BatterySettings, CableSettings } from "../schemas";
import { round } from "./constants";
import type { CableResult } from "./cables";
import type { DistributionResult } from "./distribution";
import type { MountType } from "./site";
import type { BatteryResult } from "./sizing";
import { check, type Check } from "./types";

/*
 * Fault level and protection coordination, plus a lightning screening estimate.
 *
 * Battery prospective short-circuit current: lithium (LFP) banks deliver roughly 20 × their Ah rating,
 * lead-acid about 10 ×; the battery fuse/breaker must interrupt that (DC breaking capacity).
 *
 * Inverter-fed faults: in backup/off-grid mode only the inverter supplies a fault, typically about
 * 2 × its rated current for a few cycles. A breaker trips instantly only above its magnetic threshold
 * (5 × In for B-curve, 10 × In for C-curve), so fault disconnection then relies on the RCD (earth faults)
 * or the inverter's own short-circuit shutdown.
 *
 * Lightning: expected direct strikes per year Nd = Ng · Ad · Cd · 10⁻⁶ (IEC 62305-2), with the collection
 * area of a rectangular building Ad = L·W + 2·3H·(L + W) + π·(3H)².
 */

const ISC_MULTIPLE = { lifepo4: 20, lead_acid: 10, agm: 10, gel: 8 } as const;
const MAGNETIC = { B: 5, C: 10 } as const;
const CD = { surrounded_taller: 0.25, similar: 0.5, isolated: 1, hilltop: 2 } as const;

export interface ProtectionResult {
  batteryIscKA: number;
  batteryDevice: string;
  batteryBreakingKA: number;
  inverterFaultA: number;
  circuitsRelyingOnRcd: string[];
  lightning: { ng: number; adM2: number; cd: number; nd: number; level: "low" | "moderate" | "high"; lps: boolean; acSpd: string; advice: string };
  checks: Check[];
}

export function computeProtection(x: {
  battery: BatteryResult;
  batterySettings: BatterySettings;
  cables: CableResult;
  cableSettings: CableSettings;
  inverterRatedW: number;
  distribution: DistributionResult;
  assess: Assessment;
  mount: MountType;
  gridAvailable: boolean;
}): ProtectionResult {
  const { battery, cables, distribution, assess } = x;

  // Battery fault level and the interrupting device.
  const batteryIscKA = (ISC_MULTIPLE[x.batterySettings.chemistry] * battery.bankAh) / 1000;
  const batteryBreakingKA = batteryIscKA <= 6 ? 10 : batteryIscKA <= 20 ? 20 : 100;
  const batteryDevice = batteryBreakingKA === 10 ? `${cables.batteryFuseA} A DC breaker/fuse rated ≥ 10 kA DC` : batteryBreakingKA === 20 ? `${cables.batteryFuseA} A Class T fuse (20 kA DC)` : `${cables.batteryFuseA} A NH gG/gR fuse (≥ 100 kA)`;

  // Inverter-fed faults on the essential-loads circuits.
  const inverterFaultA = (x.cableSettings.inverterFaultFactor * x.inverterRatedW) / x.cableSettings.acVoltage;
  const circuitsRelyingOnRcd = distribution.circuits.filter((c) => inverterFaultA < MAGNETIC[c.curve] * c.mcbA).map((c) => `${c.ref} (${c.mcbA} A ${c.curve})`);

  // Lightning screening.
  const L = assess.roofLengthM;
  const W = x.mount === "gable" ? 2 * assess.roofWidthM * Math.cos((assess.roofPitchDeg * Math.PI) / 180) : assess.roofWidthM;
  const H = x.mount === "ground" ? 2.5 : assess.buildingHeightM;
  const adM2 = L * W + 2 * 3 * H * (L + W) + Math.PI * (3 * H) ** 2;
  const cd = CD[assess.surroundings];
  const ng = assess.groundFlashDensity;
  const nd = ng * adM2 * cd * 1e-6;
  const level = nd < 1e-3 ? "low" : nd < 1e-2 ? "moderate" : "high";
  // Risk of loss of life R1 ≈ Nd · rf · LF ≈ Nd × 10⁻³ for an ordinary dwelling; it exceeds the tolerable
  // 10⁻⁵ only when Nd ≥ 0.01 ("high"), so an external LPS is recommended only then.
  const lps = level === "high" && x.mount !== "ground";
  const acSpd = lps || (assess.overheadSupply && level !== "low") ? "Type 1+2 SPD at the main board (Iimp ≥ 12.5 kA), Type 2 at the inverter" : "Type 2 SPD, In 20 kA";
  const advice = lps
    ? "Install an external lightning protection system (air terminals, down conductors, earth termination) to IEC 62305-3. Keep the PV array within the protected zone and at the separation distance from the LPS (typically ≥ 0.5–1 m), or bond them if that is not possible."
    : level === "moderate"
      ? "An external LPS is not essential here; keep Type 2 SPDs on DC and AC and bond the array frames to the main earth."
      : "Direct strikes are unlikely; Type 2 SPDs on DC and AC with bonded array frames are sufficient.";

  const checks: Check[] = [
    check(
      "cables",
      "pr-battery-isc",
      "Battery protection can interrupt the battery's short-circuit current",
      batteryBreakingKA >= batteryIscKA,
      `Prospective fault ≈ ${round(batteryIscKA, 1)} kA (${x.batterySettings.chemistry === "lifepo4" ? "LiFePO4" : "lead-acid"}, ${round(battery.bankAh, 0)} Ah): use a ${batteryDevice} as close to the battery as possible`,
    ),
    check(
      "cables",
      "pr-inverter-fault",
      "Breakers trip instantly on an inverter-fed short circuit",
      circuitsRelyingOnRcd.length === 0,
      circuitsRelyingOnRcd.length
        ? `The inverter supplies about ${round(inverterFaultA, 0)} A into a fault, below the instantaneous trip of ${circuitsRelyingOnRcd.join(", ")}. Keep 30 mA RCD protection on these circuits, prefer B-curve breakers, and confirm the inverter's short-circuit shutdown${x.gridAvailable ? " (the grid supplies full fault current when connected)" : ""}.`
        : `The inverter's ≈ ${round(inverterFaultA, 0)} A fault current exceeds every final circuit's magnetic trip level`,
      // Every final circuit already has a 30 mA RCBO, so this is guidance rather than a defect.
      "info",
    ),
    check("assessment", "pr-lightning", "Lightning risk assessed (IEC 62305-2 screening)", !lps, `Nd = ${ng} × ${round(adM2, 0)} m² × ${cd} × 10⁻⁶ = ${nd.toExponential(1)} strikes/year (${level}). ${lps ? "External LPS recommended." : "No external LPS needed."} AC: ${acSpd}.`, "warn"),
  ];

  return { batteryIscKA, batteryDevice, batteryBreakingKA, inverterFaultA, circuitsRelyingOnRcd, lightning: { ng, adM2, cd, nd, level, lps, acSpd, advice }, checks };
}
