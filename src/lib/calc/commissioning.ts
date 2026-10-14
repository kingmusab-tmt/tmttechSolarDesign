import type { Handover, PanelSpec, StringTest } from "../schemas";
import { round } from "./constants";
import type { StringResult } from "./sizing";
import { check, type Check } from "./types";

/*
 * Commissioning test evaluation (IEC 62446-1 category 1 tests).
 * Measured string Voc is compared with the datasheet Voc corrected to the module temperature at the
 * time of the test; Isc with the datasheet Isc scaled to the measured irradiance.
 */

export const VOC_TOLERANCE_PCT = 5;
export const ISC_TOLERANCE_PCT = 10;
export const RCD_MAX_MS = 300; // at IΔn (IEC 60364-6)

export const FUNCTIONAL_TESTS: { key: string; label: string; gridOnly?: boolean }[] = [
  { key: "inverter_start", label: "Inverter starts and synchronises; no fault codes" },
  { key: "mppt_tracking", label: "Each MPPT input reports power in sunlight" },
  { key: "battery_charge", label: "Battery charges from PV; BMS communication and charge limits correct" },
  { key: "backup", label: "Backup output holds the loads when the grid / generator is switched off", gridOnly: true },
  { key: "grid_transfer", label: "Transfer back to grid / generator and charging from it", gridOnly: true },
  { key: "isolation", label: "Every isolator and the emergency shutdown operate correctly" },
  { key: "labels", label: "Warning labels, circuit labels and the shutdown procedure are fitted" },
  { key: "monitoring", label: "Monitoring app / data logger set up and handed to the client" },
];

export type TestStatus = "pass" | "fail" | "untested";

export interface StringTestResult {
  key: string; // "S1", "S2", …
  test: StringTest;
  expectedVocV: number;
  expectedIscA: number;
  vocDevPct: number | null;
  iscDevPct: number | null;
  voc: TestStatus;
  isc: TestStatus;
  polarity: TestStatus;
  insulation: TestStatus;
}

export interface CommissioningResult {
  strings: StringTestResult[];
  insulationTestV: number;
  insulationMinMOhm: number;
  earthTargetOhm: number;
  earth: TestStatus;
  rcd: TestStatus;
  functionalDone: number;
  functionalTotal: number;
  tested: boolean;
  allPassed: boolean;
  checks: Check[];
}

const EMPTY: StringTest = { vocV: 0, iscA: 0, irradianceWm2: 0, cellTempC: 0, polarityOk: false, insulationMOhm: 0 };

/** IEC 62446-1 insulation test voltage and minimum resistance by array voltage. */
export function insulationLimits(arrayVocV: number) {
  if (arrayVocV < 120) return { testV: 250, minMOhm: 0.5 };
  if (arrayVocV <= 500) return { testV: 500, minMOhm: 1 };
  return { testV: 1000, minMOhm: 1 };
}

export function computeCommissioning(x: { handover: Handover; panel: PanelSpec; strings: StringResult; earthTargetOhm: number; gridAvailable: boolean }): CommissioningResult {
  const { handover: h, panel, strings } = x;
  const { testV, minMOhm } = insulationLimits(strings.stringVocCold);
  const results: StringTestResult[] = [];

  for (let i = 0; i < Math.max(0, strings.parallel); i++) {
    const key = `S${i + 1}`;
    const t = { ...EMPTY, ...h.stringTests[key] };
    const cell = t.cellTempC || 25;
    const expectedVocV = strings.series * panel.vocV * (1 + (panel.betaVocPct / 100) * (cell - 25));
    const expectedIscA = t.irradianceWm2 > 0 ? panel.iscA * (t.irradianceWm2 / 1000) : panel.iscA;
    const vocDevPct = t.vocV > 0 ? ((t.vocV - expectedVocV) / expectedVocV) * 100 : null;
    const iscDevPct = t.iscA > 0 && t.irradianceWm2 > 0 ? ((t.iscA - expectedIscA) / expectedIscA) * 100 : null;
    results.push({
      key,
      test: t,
      expectedVocV,
      expectedIscA,
      vocDevPct,
      iscDevPct,
      voc: vocDevPct === null ? "untested" : Math.abs(vocDevPct) <= VOC_TOLERANCE_PCT ? "pass" : "fail",
      isc: iscDevPct === null ? "untested" : Math.abs(iscDevPct) <= ISC_TOLERANCE_PCT ? "pass" : "fail",
      polarity: t.polarityOk ? "pass" : t.vocV > 0 ? "fail" : "untested",
      insulation: t.insulationMOhm > 0 ? (t.insulationMOhm >= minMOhm ? "pass" : "fail") : "untested",
    });
  }

  const earth: TestStatus = h.earthOhm > 0 ? (h.earthOhm <= x.earthTargetOhm ? "pass" : "fail") : "untested";
  const rcd: TestStatus = h.rcdTripMs > 0 ? (h.rcdTripMs <= RCD_MAX_MS ? "pass" : "fail") : "untested";
  const functional = FUNCTIONAL_TESTS.filter((f) => !f.gridOnly || x.gridAvailable);
  const functionalDone = functional.filter((f) => h.functional[f.key]).length;

  const all = results.flatMap((r) => [r.voc, r.isc, r.polarity, r.insulation]).concat([earth, rcd]);
  const tested = all.some((s) => s !== "untested");
  const allPassed = tested && all.every((s) => s === "pass") && functionalDone === functional.length;

  const checks: Check[] = [];
  if (tested) {
    const bad = (k: keyof Pick<StringTestResult, "voc" | "isc" | "polarity" | "insulation">) => results.filter((r) => r[k] === "fail").map((r) => r.key);
    const untested = (k: keyof Pick<StringTestResult, "voc" | "isc" | "polarity" | "insulation">) => results.filter((r) => r[k] === "untested").length;
    const line = (k: "voc" | "isc" | "polarity" | "insulation", id: string, label: string, ok: string, failText: (s: string[]) => string) => {
      const f = bad(k);
      checks.push(check("handover", id, label, f.length === 0 && untested(k) === 0, f.length ? failText(f) : untested(k) ? `${untested(k)} of ${results.length} string(s) not tested yet` : ok, f.length ? "fail" : "warn"));
    };
    line("voc", "hv-voc", `String Voc within ±${VOC_TOLERANCE_PCT} % of expected`, "All strings within tolerance", (s) => `Out of tolerance: ${s.join(", ")}. Check for a missing or reversed module, or a wrong series count.`);
    line("isc", "hv-isc", `String Isc within ±${ISC_TOLERANCE_PCT} % of expected (irradiance-corrected)`, "All strings within tolerance", (s) => `Out of tolerance: ${s.join(", ")}. Check shading, soiling, connectors or damaged modules.`);
    line("polarity", "hv-polarity", "Polarity correct on every string", "Verified on all strings", (s) => `Not confirmed: ${s.join(", ")}`);
    line("insulation", "hv-insulation", `Insulation resistance ≥ ${minMOhm} MΩ at ${testV} V`, `All strings ≥ ${minMOhm} MΩ`, (s) => `Below ${minMOhm} MΩ: ${s.join(", ")}. Find the insulation fault before energising.`);
    checks.push(check("handover", "hv-earth", `Earth electrode ≤ ${x.earthTargetOhm} Ω`, earth === "pass", earth === "untested" ? "Not measured yet" : `Measured ${h.earthOhm} Ω`, earth === "untested" ? "warn" : "fail"));
    checks.push(check("handover", "hv-rcd", `RCD trips within ${RCD_MAX_MS} ms at IΔn`, rcd === "pass", rcd === "untested" ? "Not measured yet" : `Measured ${round(h.rcdTripMs, 0)} ms`, rcd === "untested" ? "warn" : "fail"));
    checks.push(check("handover", "hv-functional", "Functional tests complete", functionalDone === functional.length, `${functionalDone} of ${functional.length} done`, "warn"));
  }

  return { strings: results, insulationTestV: testV, insulationMinMOhm: minMOhm, earthTargetOhm: x.earthTargetOhm, earth, rcd, functionalDone, functionalTotal: functional.length, tested, allPassed, checks };
}
