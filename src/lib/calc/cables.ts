import type { CableSettings, PanelSpec } from "../schemas";
import { CABLE_TABLE, INSTALL_METHOD, RHO_COPPER, STD_BREAKER_A, STD_PV_FUSE_A, STD_SPD_UCPV, ambientFactor, groupingFactor, nextStd, round } from "./constants";
import type { ControllerResult, StringResult } from "./sizing";
import { check, type Check } from "./types";

export interface CableSegment {
  key: string;
  label: string;
  kind: "dc" | "ac";
  lengthM: number;
  voltageV: number;
  operatingA: number; // used for voltage drop
  designA: number; // Ib, basis of protection
  protectionA: number; // In
  protectionLabel: string;
  maxDropPct: number;
  minAreaDrop: number;
  sizeMm2: number;
  ampacityA: number; // derated current-carrying capacity Iz
  baseAmpacityA: number; // table value at 30 °C, method C, ungrouped
  derating: { ambientC: number; conductorMaxC: number; ca: number; cg: number; cm: number; grouped: number; total: number };
  dropV: number;
  dropPct: number;
  runs: number; // number of identical circuits (e.g. per MPPT)
}

export interface CableResult {
  segments: CableSegment[];
  stringFuseA: number; // 0 = not required
  dcSpdUcpv: number;
  dcIsolatorA: number;
  dcIsolatorV: number;
  batteryFuseA: number;
  acBreakerA: number;
  acSpd: string;
  earthing: { bondingMm2: number; mainEarthMm2: number; electrode: string; targetOhm: number };
  checks: Check[];
}

/** Minimum cross-section for a voltage-drop limit: A = 2·L·I·ρ / ΔV */
export function minCrossSection(lengthM: number, currentA: number, voltageV: number, maxDropPct: number, rho = RHO_COPPER) {
  const dv = (maxDropPct / 100) * voltageV;
  return dv > 0 ? (2 * lengthM * currentA * rho) / dv : Infinity;
}

export function voltageDrop(lengthM: number, currentA: number, areaMm2: number, rho = RHO_COPPER) {
  return (2 * lengthM * currentA * rho) / areaMm2;
}

/**
 * Select the smallest standard size satisfying both voltage drop (Iop) and the derated
 * current-carrying capacity of its protective device: Iz = It × Ca × Cg × Cm ≥ In.
 */
export function selectCable(lengthM: number, operatingA: number, protectionA: number, voltageV: number, maxDropPct: number, minSize = 1.5, derate = 1) {
  const minAreaDrop = minCrossSection(lengthM, operatingA, voltageV, maxDropPct);
  const row = CABLE_TABLE.find((c) => c.size >= minSize && c.size >= minAreaDrop - 1e-9 && c.ampacity * derate >= protectionA) ?? CABLE_TABLE[CABLE_TABLE.length - 1];
  const dropV = voltageDrop(lengthM, operatingA, row.size);
  return { minAreaDrop, sizeMm2: row.size, ampacityA: row.ampacity * derate, baseAmpacityA: row.ampacity, dropV, dropPct: voltageV > 0 ? (dropV / voltageV) * 100 : 0 };
}

interface CableInputs {
  cables: CableSettings;
  panel: PanelSpec;
  strings: StringResult;
  controller: ControllerResult;
  systemVoltage: number;
  inverterRatedW: number;
  inverterEff: number;
  gridAvailable: boolean;
  /** Site record high, used when no indoor ambient is set. */
  siteMaxC: number;
}

export function computeCables(x: CableInputs): CableResult {
  const { cables, panel, strings, controller, systemVoltage, inverterRatedW, inverterEff, gridAvailable } = x;
  const segments: CableSegment[] = [];
  const indoorC = cables.indoorAmbientC > 0 ? cables.indoorAmbientC : Math.max(30, x.siteMaxC);
  const cm = INSTALL_METHOD[cables.installMethod].factor;
  /** PV cables (EN 50618, 120 °C) on the roof; everything else XLPE/HEPR 90 °C indoors. */
  const add = (seg: Omit<CableSegment, "minAreaDrop" | "sizeMm2" | "ampacityA" | "baseAmpacityA" | "derating" | "dropV" | "dropPct">, minSize: number, where: { roof: boolean; grouped: number }) => {
    const ambientC = where.roof ? cables.roofAmbientC : indoorC;
    const conductorMaxC = where.roof ? 120 : 90;
    const ca = ambientFactor(ambientC, conductorMaxC);
    const cg = groupingFactor(where.grouped);
    const total = ca * cg * cm;
    const sel = selectCable(seg.lengthM, seg.operatingA, seg.protectionA, seg.voltageV, seg.maxDropPct, minSize, total);
    segments.push({ ...seg, ...sel, derating: { ambientC, conductorMaxC, ca, cg, cm, grouped: where.grouped, total } });
  };

  const mppts = Math.max(1, Math.min(strings.device.mpptCount, strings.parallel));

  // String fuses are required when 3 or more strings are paralleled on one input (IEC 60364-7-712).
  const stringFuseA = strings.stringsPerMppt >= 3 ? STD_PV_FUSE_A.find((f) => f >= 1.5 * panel.iscA && f <= 2.4 * panel.iscA) ?? nextStd(STD_PV_FUSE_A, 1.5 * panel.iscA) : 0;

  // 1. PV string cable
  const strIb = 1.25 * panel.iscA;
  add(
    {
      key: "pv_string",
      label: "PV string → DC combiner / isolator",
      kind: "dc",
      lengthM: cables.pvStringLengthM,
      voltageV: strings.stringVmp,
      operatingA: panel.impA,
      designA: strIb,
      protectionA: stringFuseA || strIb * 1.25,
      protectionLabel: stringFuseA ? `${stringFuseA} A gPV string fuse (+ and −)` : "String fuse not required (< 3 parallel strings)",
      maxDropPct: cables.dcDropPct,
      runs: strings.parallel,
    },
    4,
    { roof: true, grouped: cables.bunchStrings ? strings.parallel : 1 },
  );

  // 2. PV array (per MPPT input) cable
  const arrIb = 1.25 * panel.iscA * strings.stringsPerMppt;
  const dcIsolatorA = nextStd(STD_BREAKER_A, 1.25 * arrIb);
  const dcIsolatorV = Math.ceil(strings.stringVocCold / 50) * 50;
  add(
    {
      key: "pv_array",
      label: controller.applicable ? "DC isolator → charge controller PV input" : "DC isolator → inverter PV input (per MPPT)",
      kind: "dc",
      lengthM: cables.pvArrayLengthM,
      voltageV: strings.stringVmp,
      operatingA: panel.impA * strings.stringsPerMppt,
      designA: arrIb,
      protectionA: dcIsolatorA,
      protectionLabel: `${dcIsolatorA} A DC isolator/breaker, ≥ ${dcIsolatorV} V DC`,
      maxDropPct: cables.dcDropPct,
      runs: mppts,
    },
    4,
    { roof: true, grouped: mppts },
  );

  // 3. Charge controller → battery
  if (controller.applicable) {
    const ib = controller.ratedA;
    const inA = nextStd(STD_BREAKER_A, 1.25 * ib);
    add(
      {
        key: "ctrl_batt",
        label: "Charge controller → battery bus",
        kind: "dc",
        lengthM: cables.ctrlBattLengthM,
        voltageV: systemVoltage,
        operatingA: ib,
        designA: ib,
        protectionA: inA,
        protectionLabel: `${inA} A DC breaker/fuse`,
        maxDropPct: cables.batteryDropPct,
        runs: controller.count,
      },
      6,
      { roof: false, grouped: controller.count },
    );
  }

  // 4. Battery → inverter
  const battIb = inverterRatedW / (systemVoltage * inverterEff);
  const batteryFuseA = nextStd(STD_BREAKER_A, 1.25 * battIb);
  add(
    {
      key: "batt_inv",
      label: "Battery bank → inverter (DC)",
      kind: "dc",
      lengthM: cables.battInvLengthM,
      voltageV: systemVoltage,
      operatingA: battIb,
      designA: battIb,
      protectionA: batteryFuseA,
      protectionLabel: `${batteryFuseA} A Class-T / NH battery fuse + isolator`,
      maxDropPct: cables.batteryDropPct,
      runs: 1,
    },
    10,
    { roof: false, grouped: 1 },
  );

  // 5. Inverter AC output
  const acIb = inverterRatedW / cables.acVoltage;
  const acBreakerA = nextStd(STD_BREAKER_A, 1.25 * acIb);
  add(
    {
      key: "ac_out",
      label: "Inverter AC output → distribution board",
      kind: "ac",
      lengthM: cables.acOutLengthM,
      voltageV: cables.acVoltage,
      operatingA: acIb,
      designA: acIb,
      protectionA: acBreakerA,
      protectionLabel: `${acBreakerA} A double-pole MCB (Type C)`,
      maxDropPct: cables.acDropPct,
      runs: 1,
    },
    2.5,
    { roof: false, grouped: gridAvailable ? 2 : 1 },
  );

  // 6. Grid / generator AC input
  if (gridAvailable)
    add(
      {
        key: "ac_in",
        label: "Grid / generator → inverter AC input",
        kind: "ac",
        lengthM: cables.acInLengthM,
        voltageV: cables.acVoltage,
        operatingA: acIb,
        designA: acIb,
        protectionA: acBreakerA,
        protectionLabel: `${acBreakerA} A double-pole MCB + changeover`,
        maxDropPct: cables.acDropPct,
        runs: 1,
      },
      2.5,
      { roof: false, grouped: 2 },
    );

  const dcSpdUcpv = nextStd(STD_SPD_UCPV, 1.2 * strings.stringVocCold);
  const checks: Check[] = segments.map((s) =>
    check("cables", `cab-${s.key}`, `${s.label}: drop ≤ ${s.maxDropPct} %`, s.dropPct <= s.maxDropPct + 1e-6, `${s.sizeMm2} mm² carries ${round(s.operatingA, 1)} A over ${s.lengthM} m → ${round(s.dropV, 2)} V (${round(s.dropPct, 2)} %)`, "warn"),
  );
  // Current-carrying capacity after derating must cover the protective device (Iz ≥ In).
  for (const s of segments) {
    const d = s.derating;
    checks.push(
      check(
        "cables",
        `cab-iz-${s.key}`,
        `${s.label}: derated capacity Iz ≥ In`,
        s.ampacityA >= s.protectionA - 1e-6,
        `${s.sizeMm2} mm²: ${s.baseAmpacityA} A × Ca ${round(d.ca, 2)} (${d.ambientC} °C) × Cg ${round(d.cg, 2)}${d.grouped > 1 ? ` (${d.grouped} grouped)` : ""} × Cm ${round(d.cm, 2)} = ${round(s.ampacityA, 1)} A vs In ${round(s.protectionA, 0)} A`,
      ),
    );
  }
  checks.push(check("cables", "cab-spd", "DC SPD voltage rating", dcSpdUcpv >= 1.2 * strings.stringVocCold, `Type II DC SPD Ucpv ${dcSpdUcpv} V ≥ 1.2 × ${round(strings.stringVocCold, 0)} V`));

  return {
    segments,
    stringFuseA,
    dcSpdUcpv,
    dcIsolatorA,
    dcIsolatorV,
    batteryFuseA,
    acBreakerA,
    acSpd: "Type II AC SPD, Uc 275 V, In 20 kA (L-N + N-PE)",
    earthing: { bondingMm2: 6, mainEarthMm2: 16, electrode: "Copper-bonded rod, 1.2 m+ with inspection pit", targetOhm: 10 },
    checks,
  };
}
