import type {
  BatterySettings,
  InverterSpec,
  ControllerSettings,
  InverterSettings,
  LoadItem,
  PanelSpec,
  PvSettings,
  StringSettings,
} from "../schemas";
import { CHEMISTRY_INFO, STD_CONTROLLER_A, STD_INVERTER_W, T_STC, nextStd, round } from "./constants";
import { check, type Check } from "./types";

/* ------------------------------------------------------------------ */
/* Step 2 — Load audit                                                 */
/* ------------------------------------------------------------------ */

export interface LoadResult {
  rows: (LoadItem & { totalW: number; dailyWh: number; startingW: number })[];
  connectedW: number;
  continuousW: number;
  dailyWh: number;
  largestMotorExtraW: number;
  largestMotorName: string;
  peakSurgeW: number;
  byCategory: { category: string; dailyWh: number; totalW: number }[];
  checks: Check[];
}

export function computeLoad(loads: LoadItem[], demandFactor = 1): LoadResult {
  const rows = loads.map((l) => {
    const totalW = l.watts * l.qty;
    return {
      ...l,
      totalW,
      dailyWh: totalW * l.hoursPerDay,
      // One unit starting at a time: its starting draw is surgeFactor × its running watts.
      startingW: l.inductive ? l.watts * l.surgeFactor : l.watts,
    };
  });
  const connectedW = rows.reduce((a, r) => a + r.totalW, 0);
  const dailyWh = rows.reduce((a, r) => a + r.dailyWh, 0);
  const continuousW = connectedW * demandFactor;

  let largestMotorExtraW = 0;
  let largestMotorName = "";
  for (const r of rows) {
    if (!r.inductive || r.qty <= 0) continue;
    const extra = r.watts * (r.surgeFactor - 1);
    if (extra > largestMotorExtraW) {
      largestMotorExtraW = extra;
      largestMotorName = r.name;
    }
  }
  // Worst case: everything running continuously while the largest motor starts.
  const peakSurgeW = continuousW + largestMotorExtraW;

  const cat = new Map<string, { dailyWh: number; totalW: number }>();
  for (const r of rows) {
    const c = cat.get(r.category) ?? { dailyWh: 0, totalW: 0 };
    c.dailyWh += r.dailyWh;
    c.totalW += r.totalW;
    cat.set(r.category, c);
  }
  const byCategory = [...cat.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.dailyWh - a.dailyWh);

  const checks: Check[] = [
    check("loads", "loads-present", "Load list entered", rows.length > 0 && dailyWh > 0, rows.length ? `${rows.length} appliance lines, ${round(dailyWh / 1000, 2)} kWh/day` : "Add at least one appliance", "fail"),
  ];
  const inductiveWithoutSurge = rows.filter((r) => r.inductive && r.surgeFactor < 2);
  if (inductiveWithoutSurge.length)
    checks.push(check("loads", "surge-factors", "Inductive surge factors", false, `${inductiveWithoutSurge.map((r) => r.name).join(", ")} has a surge factor below 2×; motors typically start at about 3×`, "warn"));

  return { rows, connectedW, continuousW, dailyWh, largestMotorExtraW, largestMotorName, peakSurgeW, byCategory, checks };
}

/* ------------------------------------------------------------------ */
/* Step 3 — Inverter                                                   */
/* ------------------------------------------------------------------ */

export interface InverterResult {
  requiredContinuousW: number;
  requiredSurgeW: number;
  recommendedSizeW: number;
  /** True when the auto size was increased so a hybrid can accept the required PV array. */
  sizedForPv: boolean;
  autoVoltage: 12 | 24 | 48;
  systemVoltage: 12 | 24 | 48;
  ratedPowerW: number;
  surgePowerW: number;
  isSelected: boolean;
  /** Datasheet values in effect: the selected model, or a generic hybrid matched to the auto size. */
  spec: InverterSpec;
  loadingPct: number;
  checks: Check[];
}

/**
 * Typical hybrid-inverter PV input limits by battery voltage, used until a real model is chosen,
 * so string sizing and charge checks match the inverter size actually being recommended.
 */
export function genericInverterSpec(ratedPowerW: number, systemVoltage: 12 | 24 | 48): InverterSpec {
  const pv = {
    12: { maxPvVoltage: 145, mpptMinV: 30, mpptMaxV: 130, maxPvInputCurrentA: 40, maxPvIscA: 50 },
    24: { maxPvVoltage: 500, mpptMinV: 120, mpptMaxV: 450, maxPvInputCurrentA: 18, maxPvIscA: 22 },
    48: { maxPvVoltage: 500, mpptMinV: 120, mpptMaxV: 450, maxPvInputCurrentA: 22, maxPvIscA: 27 },
  }[systemVoltage];
  const maxPvPowerW = Math.round(ratedPowerW * GENERIC_PV_RATIO);
  return {
    brand: "Generic",
    model: `Hybrid ${ratedPowerW / 1000} kW / ${systemVoltage} V`,
    ratedPowerW,
    surgePowerW: ratedPowerW * 2,
    ...pv,
    maxPvPowerW,
    mpptCount: systemVoltage === 48 && ratedPowerW > 6500 ? 2 : 1,
    maxChargeCurrentA: Math.ceil(maxPvPowerW / systemVoltage / 10) * 10,
  };
}

export function autoSystemVoltage(requiredW: number): 12 | 24 | 48 {
  if (requiredW <= 1500) return 12;
  if (requiredW <= 3000) return 24;
  return 48;
}

/** Typical hybrid PV input allowance relative to AC rating, and the share we design to (headroom for string rounding). */
export const GENERIC_PV_RATIO = 1.5;
const PV_DESIGN_RATIO = 1.3;

export function computeInverter(load: LoadResult, inv: InverterSettings, requiredPvW = 0): InverterResult {
  const requiredContinuousW = load.continuousW * inv.margin;
  const requiredSurgeW = load.peakSurgeW;
  const loadSizeW = nextStd(STD_INVERTER_W, requiredContinuousW);
  // A hybrid's built-in MPPT must also accept the PV array, which can govern the size on poor-sun sites.
  const pvSizeW = inv.type === "hybrid" && requiredPvW > 0 ? nextStd(STD_INVERTER_W, requiredPvW / PV_DESIGN_RATIO) : 0;
  const recommendedSizeW = Math.max(loadSizeW, pvSizeW);
  const sizedForPv = pvSizeW > loadSizeW;
  const autoVoltage = autoSystemVoltage(requiredContinuousW);
  const systemVoltage = (inv.systemVoltage || autoVoltage) as 12 | 24 | 48;
  const isSelected = inv.selected.ratedPowerW > 0;
  const ratedPowerW = isSelected ? inv.selected.ratedPowerW : recommendedSizeW;
  const surgePowerW = inv.selected.surgePowerW > 0 ? inv.selected.surgePowerW : ratedPowerW * 2;
  const loadingPct = ratedPowerW > 0 ? (load.continuousW / ratedPowerW) * 100 : 0;
  const spec = isSelected ? { ...inv.selected, surgePowerW } : genericInverterSpec(ratedPowerW, systemVoltage);

  const checks: Check[] = [
    check("inverter", "inv-continuous", "Continuous rating ≥ load × margin", ratedPowerW >= requiredContinuousW - 1e-6, `${ratedPowerW} W rated vs ${round(requiredContinuousW, 0)} W required (${round(loadingPct, 0)} % loading)`),
    check("inverter", "inv-surge", "Surge rating covers motor starting", surgePowerW >= requiredSurgeW - 1e-6, `${round(surgePowerW, 0)} W surge vs ${round(requiredSurgeW, 0)} W peak${load.largestMotorName ? ` (largest motor: ${load.largestMotorName})` : ""}`),
  ];
  if (inv.systemVoltage && inv.systemVoltage < autoVoltage)
    checks.push(check("inverter", "inv-voltage", "System voltage suits the load", false, `${inv.systemVoltage} V selected; ${autoVoltage} V recommended for ${round(requiredContinuousW, 0)} W to keep DC currents and cable sizes manageable`, "warn"));
  if (!isSelected && sizedForPv)
    checks.push({ id: "inv-pv-sized", step: "inverter", label: "Size increased for PV input", status: "info", detail: `The load needs ${loadSizeW} W, but a ${recommendedSizeW} W hybrid is recommended so its MPPT can accept the ${round(requiredPvW, 0)} Wp array` });
  if (!isSelected)
    checks.push({ id: "inv-selected", step: "inverter", label: "Inverter model selected", status: "info", detail: `No model selected yet; using a generic ${recommendedSizeW / 1000} kW / ${systemVoltage} V hybrid (PV input ${spec.mpptMinV}–${spec.mpptMaxV} V, max ${spec.maxPvVoltage} V)` });
  return { requiredContinuousW, requiredSurgeW, recommendedSizeW, sizedForPv, autoVoltage, systemVoltage, ratedPowerW, surgePowerW, isSelected, spec, loadingPct, checks };
}

/* ------------------------------------------------------------------ */
/* Step 4 — Battery bank                                               */
/* ------------------------------------------------------------------ */

export interface BatteryResult {
  requiredWh: number;
  requiredAh: number;
  seriesCount: number;
  parallelCount: number;
  totalUnits: number;
  bankVoltage: number;
  bankAh: number;
  bankKWh: number;
  usableKWh: number;
  actualAutonomyDays: number;
  maxDischargeA: number;
  dischargeC: number;
  chargeCurrentA: number;
  chargeC: number;
  checks: Check[];
}

/** Total Battery Capacity (Ah) = (Daily Wh × Days of autonomy) / (V × DoD × η_inv) */
export function batteryAh(dailyWh: number, autonomy: number, voltage: number, dod: number, invEff: number) {
  return (dailyWh * autonomy) / (voltage * dod * invEff);
}

export function computeBattery(dailyWh: number, systemVoltage: number, inverterRatedW: number, invEff: number, bat: BatterySettings, chargeCurrentA: number): BatteryResult {
  const requiredAh = batteryAh(dailyWh, bat.daysOfAutonomy, systemVoltage, bat.dod, invEff);
  const requiredWh = requiredAh * systemVoltage;
  const seriesCount = Math.max(1, Math.round(systemVoltage / bat.unitVoltage));
  const bankVoltage = seriesCount * bat.unitVoltage;
  const parallelCount = Math.max(1, Math.ceil(requiredAh / bat.unitAh - 1e-9));
  const totalUnits = seriesCount * parallelCount;
  const bankAh = parallelCount * bat.unitAh;
  const bankKWh = (bankAh * bankVoltage) / 1000;
  const usableKWh = bankKWh * bat.dod;
  const actualAutonomyDays = dailyWh > 0 ? (usableKWh * 1000 * invEff) / dailyWh : 0;
  const maxDischargeA = inverterRatedW / (systemVoltage * invEff);
  const dischargeC = bankAh > 0 ? maxDischargeA / bankAh : 0;

  const chargeC = bankAh > 0 ? chargeCurrentA / bankAh : 0;
  const chem = CHEMISTRY_INFO[bat.chemistry];

  const checks: Check[] = [
    check("battery", "bat-capacity", "Bank capacity ≥ required", bankAh >= requiredAh - 1e-6, `${round(bankAh, 0)} Ah installed vs ${round(requiredAh, 0)} Ah required at ${systemVoltage} V`),
    check("battery", "bat-dod", `DoD suitable for ${chem.label}`, bat.dod <= chem.dod + 0.051, `DoD ${round(bat.dod * 100, 0)} % (recommended ≤ ${round(chem.dod * 100, 0)} %)`, "warn"),
    check("battery", "bat-discharge", "Discharge rate within battery limit", dischargeC <= bat.maxDischargeCRate + 1e-6, `Full inverter load draws ${round(maxDischargeA, 0)} A = ${round(dischargeC, 2)}C (limit ${bat.maxDischargeCRate}C)`, "warn"),
    check("battery", "bat-charge", "Charge rate within battery limit", chargeC <= bat.maxChargeCRate + 1e-6, `Peak PV charging ≈ ${round(chargeCurrentA, 0)} A = ${round(chargeC, 2)}C (limit ${bat.maxChargeCRate}C)`, "warn"),
    check("battery", "bat-voltage", "Battery string matches system voltage", Math.abs(bankVoltage - systemVoltage) / systemVoltage < 0.15, `${seriesCount} × ${bat.unitVoltage} V = ${round(bankVoltage, 1)} V for a ${systemVoltage} V system`),
  ];
  if (bat.chemistry !== "lifepo4" && parallelCount > 4)
    checks.push(check("battery", "bat-parallel", "Parallel strings limited", false, `${parallelCount} parallel strings; lead-acid banks with more than 4 strings suffer current imbalance. Use larger cells or a higher voltage.`, "warn"));
  return { requiredWh, requiredAh, seriesCount, parallelCount, totalUnits, bankVoltage, bankAh, bankKWh, usableKWh, actualAutonomyDays, maxDischargeA, dischargeC, chargeCurrentA, chargeC, checks };
}

/* ------------------------------------------------------------------ */
/* Step 5 — PV array (energy requirement)                              */
/* ------------------------------------------------------------------ */

export interface PvRequirement {
  shadingFactor: number;
  requiredGenerationWh: number;
  requiredPvW: number;
  panelsRequired: number;
}

export function computePvRequirement(dailyWh: number, psh: number, pv: PvSettings, shadingLossPct: number): PvRequirement {
  const shadingFactor = 1 - shadingLossPct / 100;
  const requiredGenerationWh = dailyWh / (pv.systemEfficiency * shadingFactor);
  const requiredPvW = requiredGenerationWh / psh;
  const panelsRequired = Math.max(dailyWh > 0 ? 1 : 0, Math.ceil(requiredPvW / pv.panel.pmaxW - 1e-9));
  return { shadingFactor, requiredGenerationWh, requiredPvW, panelsRequired };
}

/* ------------------------------------------------------------------ */
/* Step 6 — String sizing with temperature correction                  */
/* ------------------------------------------------------------------ */

export interface PvInputDevice {
  label: string;
  maxDcVoltage: number;
  mpptMinV: number;
  mpptMaxV: number;
  maxInputCurrentA: number; // per MPPT, 0 = unlimited
  maxIscA: number; // per MPPT, 0 = unlimited
  mpptCount: number;
  maxPvPowerW: number; // 0 = unlimited
}

/** Vmax = Voc × [1 + (β/100) × (Tmin − 25)] */
export function vocAtTemp(voc: number, betaPct: number, tempC: number) {
  return voc * (1 + (betaPct / 100) * (tempC - T_STC));
}

/** Cell temperature at 1000 W/m² from ambient and NOCT. */
export function cellTemp(ambientC: number, noctC: number, irradiance = 1000) {
  return ambientC + ((noctC - 20) / 800) * irradiance;
}

export function maxSeriesPanels(maxDcVoltage: number, vocCold: number) {
  return Math.floor(maxDcVoltage / vocCold + 1e-9);
}

export interface StringResult {
  device: PvInputDevice;
  tDiff: number;
  vocIncreasePct: number;
  vocCold: number;
  cellTempHot: number;
  vmpHot: number;
  vmpCold: number;
  maxSeries: number;
  maxSeriesMppt: number;
  minSeries: number;
  feasible: boolean;
  series: number;
  parallel: number;
  stringsPerMppt: number;
  totalPanels: number;
  arrayW: number;
  stringVocCold: number;
  stringVmp: number;
  stringVmpHot: number;
  stringVmpCold: number;
  mpptCurrentA: number;
  mpptIscA: number;
  dcAcRatio: number;
  checks: Check[];
}

export function computeStrings(panel: PanelSpec, device: PvInputDevice, tMin: number, tMax: number, panelsRequired: number, settings: StringSettings, inverterRatedW: number): StringResult {
  const tDiff = tMin - T_STC;
  const vocIncreasePct = (panel.betaVocPct / 100) * tDiff * 100;
  const vocCold = vocAtTemp(panel.vocV, panel.betaVocPct, tMin);
  const cellTempHot = cellTemp(tMax, panel.noctC);
  const vmpHot = panel.vmpV * (1 + (panel.gammaPmaxPct / 100) * (cellTempHot - T_STC));
  const vmpCold = panel.vmpV * (1 + (panel.betaVocPct / 100) * (tMin - T_STC));

  const maxSeries = maxSeriesPanels(device.maxDcVoltage, vocCold);
  const maxSeriesMppt = Math.floor(device.mpptMaxV / vmpCold + 1e-9);
  const minSeries = Math.max(1, Math.ceil(device.mpptMinV / vmpHot - 1e-9));
  const upper = Math.min(maxSeries, maxSeriesMppt);
  const feasible = maxSeries >= 1 && minSeries <= maxSeries;

  const perMpptByCurrent = (iLimit: number, iPanel: number) => (iLimit > 0 ? Math.max(1, Math.floor(iLimit / iPanel + 1e-9)) : Infinity);
  const maxParallelPerMppt = Math.min(perMpptByCurrent(device.maxInputCurrentA, panel.impA), perMpptByCurrent(device.maxIscA, panel.iscA));

  let series: number;
  let parallel: number;
  const need = Math.max(1, panelsRequired);
  if (settings.seriesOverride > 0) {
    series = settings.seriesOverride;
    parallel = settings.parallelOverride > 0 ? settings.parallelOverride : Math.ceil(need / series);
  } else if (!feasible) {
    series = Math.max(1, maxSeries);
    parallel = settings.parallelOverride > 0 ? settings.parallelOverride : Math.ceil(need / series);
  } else {
    // Search series counts in the optimal window (fall back to the absolute window), minimising
    // total panels ≥ requirement; prefer longer strings (fewer parallel strings) on ties.
    const lo = minSeries;
    const hi = upper >= minSeries ? upper : maxSeries;
    let best: { s: number; p: number; total: number } | null = null;
    for (let s = hi; s >= lo; s--) {
      const p = settings.parallelOverride > 0 ? settings.parallelOverride : Math.ceil(need / s);
      const total = s * p;
      if (!best || total < best.total) best = { s, p, total };
    }
    series = best!.s;
    parallel = best!.p;
  }

  const mpptCount = Math.max(1, device.mpptCount);
  const stringsPerMppt = Math.ceil(parallel / mpptCount);
  const totalPanels = series * parallel;
  const arrayW = totalPanels * panel.pmaxW;
  const stringVocCold = series * vocCold;
  const stringVmp = series * panel.vmpV;
  const stringVmpHot = series * vmpHot;
  const stringVmpCold = series * vmpCold;
  const mpptCurrentA = stringsPerMppt * panel.impA;
  const mpptIscA = stringsPerMppt * panel.iscA;
  const dcAcRatio = inverterRatedW > 0 ? arrayW / inverterRatedW : 0;

  const checks: Check[] = [
    check("strings", "str-voc", "Cold string Voc ≤ max DC input", stringVocCold <= device.maxDcVoltage + 1e-6, `${series} × ${round(vocCold, 2)} V = ${round(stringVocCold, 1)} V at ${tMin} °C vs ${device.maxDcVoltage} V limit (${device.label})`),
    check("strings", "str-mppt-min", "Hot string Vmp ≥ MPPT minimum", stringVmpHot >= device.mpptMinV - 1e-6, `${round(stringVmpHot, 1)} V at ${round(cellTempHot, 0)} °C cell temperature vs ${device.mpptMinV} V MPPT minimum`, "warn"),
    check("strings", "str-mppt-max", "Cold string Vmp ≤ MPPT maximum", stringVmpCold <= device.mpptMaxV + 1e-6, `${round(stringVmpCold, 1)} V vs ${device.mpptMaxV} V MPPT maximum`, "warn"),
    check("strings", "str-req", "Array meets energy requirement", totalPanels >= panelsRequired, `${totalPanels} panels installed vs ${panelsRequired} required`, "warn"),
  ];
  if (device.maxInputCurrentA > 0)
    checks.push(check("strings", "str-current", "MPPT operating current within limit", mpptCurrentA <= device.maxInputCurrentA + 1e-6, `${stringsPerMppt} string(s) × ${panel.impA} A = ${round(mpptCurrentA, 1)} A vs ${device.maxInputCurrentA} A per MPPT (excess is clipped)`, "warn"));
  if (device.maxIscA > 0)
    checks.push(check("strings", "str-isc", "MPPT short-circuit current within limit", mpptIscA <= device.maxIscA + 1e-6, `${round(mpptIscA, 1)} A vs ${device.maxIscA} A max Isc per MPPT`));
  if (device.maxPvPowerW > 0)
    checks.push(check("strings", "str-power", "Array power within device PV input rating", arrayW <= device.maxPvPowerW + 1e-6, `${round(arrayW / 1000, 2)} kWp vs ${round(device.maxPvPowerW / 1000, 2)} kWp max PV input`, "warn"));
  if (!feasible)
    checks.push(check("strings", "str-feasible", "A valid string length exists", false, `The minimum ${minSeries} panels needed for MPPT exceeds the maximum ${maxSeries} allowed by the voltage limit. Choose a different panel or device.`));
  if (Number.isFinite(maxParallelPerMppt) && stringsPerMppt > maxParallelPerMppt)
    checks.push(check("strings", "str-parallel", "Parallel strings per MPPT", false, `${stringsPerMppt} strings per MPPT exceeds about ${maxParallelPerMppt} allowed by the input current; add MPPTs, controllers or inverters`, "warn"));

  return { device, tDiff, vocIncreasePct, vocCold, cellTempHot, vmpHot, vmpCold, maxSeries, maxSeriesMppt, minSeries, feasible, series, parallel, stringsPerMppt, totalPanels, arrayW, stringVocCold, stringVmp, stringVmpHot, stringVmpCold, mpptCurrentA, mpptIscA, dcAcRatio, checks };
}

/* ------------------------------------------------------------------ */
/* Step 7 — Charge controller                                          */
/* ------------------------------------------------------------------ */

export interface ControllerResult {
  applicable: boolean;
  requiredA: number;
  recommendedA: number;
  ratedA: number;
  count: number;
  hybridChargeA: number;
  checks: Check[];
}

/** Rating (A) = PV W / battery V × safety margin (1.25). */
export function controllerCurrent(pvW: number, batteryV: number, margin = 1.25) {
  return (pvW / batteryV) * margin;
}

export function computeController(inv: InverterSettings, ctrl: ControllerSettings, arrayW: number, systemVoltage: number, inverterMaxChargeA: number): ControllerResult {
  const applicable = inv.type === "standalone";
  const requiredA = controllerCurrent(arrayW, systemVoltage, ctrl.margin);
  const maxStd = STD_CONTROLLER_A[STD_CONTROLLER_A.length - 1];
  const recommendedA = requiredA > maxStd ? 100 : nextStd(STD_CONTROLLER_A, requiredA);
  const ratedA = ctrl.ratedCurrentA > 0 ? ctrl.ratedCurrentA : recommendedA;
  const count = Math.max(1, Math.ceil(requiredA / ratedA - 1e-9));
  const hybridChargeA = arrayW / systemVoltage;
  const checks: Check[] = [];
  if (applicable) {
    checks.push(check("controller", "cc-rating", "Controller current ≥ PV current × margin", ratedA * count >= requiredA - 1e-6, `${count} × ${ratedA} A vs ${round(requiredA, 1)} A required`));
    if (ctrl.maxPvPowerW > 0)
      checks.push(check("controller", "cc-power", "Array within controller PV power rating", arrayW <= ctrl.maxPvPowerW * count + 1e-6, `${round(arrayW, 0)} W vs ${ctrl.maxPvPowerW * count} W`, "warn"));
  } else {
    checks.push({ id: "cc-skip", step: "controller", label: "Built-in MPPT (hybrid inverter)", status: "info", detail: "No standalone charge controller needed; the hybrid inverter's built-in MPPT is used." });
    checks.push(check("controller", "cc-hybrid-charge", "Inverter MPPT charge current adequate", inverterMaxChargeA >= hybridChargeA - 1e-6, `PV can supply ≈ ${round(hybridChargeA, 0)} A; inverter max charge current ${inverterMaxChargeA} A`, "warn"));
  }
  return { applicable, requiredA, recommendedA, ratedA, count, hybridChargeA, checks };
}
