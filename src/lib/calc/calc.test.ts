import { describe, expect, it } from "vitest";
import { defaultInputs, PanelSpecSchema, StringsSchema } from "../schemas";
import { minCrossSection, selectCable } from "./cables";
import { computeFinancial, irr } from "./financial";
import { computeDesign } from "./index";
import {
  autoSystemVoltage,
  batteryAh,
  computeLoad,
  computeStrings,
  controllerCurrent,
  maxSeriesPanels,
  vocAtTemp,
  type PvInputDevice,
} from "./sizing";

describe("string sizing (temperature-corrected Voc)", () => {
  it("reproduces the worked example: 41.5 V, -0.29 %/°C, 0 °C → 44.51 V → 13 panels on 600 V", () => {
    const vmax = vocAtTemp(41.5, -0.29, 0);
    expect(vmax).toBeCloseTo(44.51, 2);
    expect(maxSeriesPanels(600, vmax)).toBe(13);
  });

  it("computeStrings never exceeds the max DC input", () => {
    const panel = PanelSpecSchema.parse({ vocV: 41.5, betaVocPct: -0.29, vmpV: 34.5 });
    const device: PvInputDevice = { label: "inverter", maxDcVoltage: 600, mpptMinV: 120, mpptMaxV: 550, maxInputCurrentA: 0, maxIscA: 0, mpptCount: 1, maxPvPowerW: 0 };
    const r = computeStrings(panel, device, 0, 35, 26, StringsSchema.parse({}), 5000);
    expect(r.maxSeries).toBe(13);
    expect(r.series).toBeLessThanOrEqual(13);
    expect(r.stringVocCold).toBeLessThanOrEqual(600);
    expect(r.totalPanels).toBeGreaterThanOrEqual(26);
    expect(r.tDiff).toBe(-25);
    expect(r.vocIncreasePct).toBeCloseTo(7.25, 2);
  });
});

describe("load audit", () => {
  it("sums continuous power, daily energy and motor surge", () => {
    const r = computeLoad([
      { id: "a", name: "LED bulb", category: "Lighting", watts: 10, qty: 10, hoursPerDay: 6, inductive: false, surgeFactor: 1 },
      { id: "b", name: "Fridge", category: "Refrigeration", watts: 150, qty: 1, hoursPerDay: 10, inductive: true, surgeFactor: 3 },
    ]);
    expect(r.connectedW).toBe(250);
    expect(r.dailyWh).toBe(600 + 1500);
    expect(r.peakSurgeW).toBe(250 + 300);
  });
});

describe("sizing formulas", () => {
  it("battery Ah = Wh × autonomy / (V × DoD × η)", () => {
    expect(batteryAh(5000, 1, 24, 0.5, 0.9)).toBeCloseTo(462.96, 1);
  });
  it("charge controller = PV W / V × 1.25", () => {
    expect(controllerCurrent(2000, 24)).toBeCloseTo(104.17, 1);
  });
  it("auto system voltage", () => {
    expect(autoSystemVoltage(1000)).toBe(12);
    expect(autoSystemVoltage(2500)).toBe(24);
    expect(autoSystemVoltage(6000)).toBe(48);
  });
  it("cable cross-section from voltage drop", () => {
    // 2 × 10 m × 20 A × 0.0175 / (3 % of 24 V) = 9.72 mm²
    expect(minCrossSection(10, 20, 24, 3)).toBeCloseTo(9.72, 2);
    const c = selectCable(10, 20, 25, 24, 3);
    expect(c.sizeMm2).toBe(10);
    expect(c.dropPct).toBeLessThanOrEqual(3);
  });
});

describe("financials", () => {
  it("IRR solves NPV = 0", () => {
    expect(irr([-100, 110])!).toBeCloseTo(0.1, 4);
  });
  it("payback is reached for a profitable system", () => {
    const fin = defaultInputs().financial;
    const r = computeFinancial({ fin: { ...fin, escalationPct: 0, omPctOfCapex: 0, degradationPct: 0, inverterLifeYears: 0 }, capex: 1_000_000, batteryCost: 0, inverterCost: 0, dailyYieldKWh: 10, dailyDemandKWh: 10, defaultBatteryLife: 0 });
    // Savings: (30k + 80k) × 12 × 0.9 = 1.188M/yr → payback ≈ 0.84 years
    expect(r.paybackYears!).toBeCloseTo(1_000_000 / 1_188_000, 2);
  });
});

describe("computeDesign end-to-end", () => {
  it("produces a consistent design from defaults plus loads", () => {
    const d = defaultInputs();
    d.loads = [
      { id: "1", name: "LED bulbs", category: "Lighting", watts: 10, qty: 12, hoursPerDay: 6, inductive: false, surgeFactor: 1 },
      { id: "2", name: "Refrigerator", category: "Refrigeration", watts: 150, qty: 1, hoursPerDay: 12, inductive: true, surgeFactor: 3 },
      { id: "3", name: "TV", category: "Entertainment", watts: 100, qty: 1, hoursPerDay: 6, inductive: false, surgeFactor: 1 },
      { id: "4", name: "Fans", category: "Cooling", watts: 75, qty: 3, hoursPerDay: 8, inductive: true, surgeFactor: 2 },
    ];
    const r = computeDesign(d);
    expect(r.load.dailyWh).toBe(720 + 1800 + 600 + 1800);
    expect(r.inverter.ratedPowerW).toBeGreaterThanOrEqual(r.inverter.requiredContinuousW);
    expect(r.strings.totalPanels).toBeGreaterThanOrEqual(r.pv.panelsRequired);
    expect(r.strings.stringVocCold).toBeLessThanOrEqual(r.inverter.spec.maxPvVoltage);
    expect(r.battery.bankAh).toBeGreaterThanOrEqual(r.battery.requiredAh);
    expect(r.boq.grandTotal).toBeGreaterThan(0);
    expect(r.cables.segments.length).toBeGreaterThanOrEqual(4);
    expect(r.checks.filter((c) => c.status === "fail")).toEqual([]);
  });
});

describe("generic inverter (no model selected)", () => {
  it("matches the auto size and voltage, so no false charge-current warning", async () => {
    const { sampleLoads } = await import("../appliances");
    const d = defaultInputs();
    d.loads = sampleLoads();
    const r = computeDesign(d);
    expect(r.inverter.isSelected).toBe(false);
    expect(r.inverter.spec.ratedPowerW).toBe(r.inverter.recommendedSizeW);
    expect(r.inverter.spec.maxChargeCurrentA).toBeGreaterThanOrEqual(r.controller.hybridChargeA);
    expect(r.checks.filter((c) => c.status === "warn" || c.status === "fail")).toEqual([]);
  });
  it("uses the selected model's datasheet once one is entered", () => {
    const d = defaultInputs();
    d.loads = [{ id: "1", name: "Load", category: "Other", watts: 1000, qty: 1, hoursPerDay: 5, inductive: false, surgeFactor: 1 }];
    d.inverter.selected = { ...d.inverter.selected, ratedPowerW: 3500, maxPvVoltage: 450, maxChargeCurrentA: 60 };
    const r = computeDesign(d);
    expect(r.inverter.isSelected).toBe(true);
    expect(r.inverter.spec.maxPvVoltage).toBe(450);
    expect(r.strings.device.maxDcVoltage).toBe(450);
  });
});

describe("hybrid sizing on poor-sun sites", () => {
  it("raises the auto inverter size so its MPPT can take the required array", async () => {
    const { sampleLoads } = await import("../appliances");
    const d = defaultInputs();
    d.loads = sampleLoads();
    d.site.peakSunHours = 3.0;
    d.battery.daysOfAutonomy = 3;
    const r = computeDesign(d);
    expect(r.inverter.sizedForPv).toBe(true);
    expect(r.strings.arrayW).toBeLessThanOrEqual(r.inverter.spec.maxPvPowerW);
    // Engineering checks are clean; the economics of 3 days' storage may legitimately warn.
    expect(r.checks.filter((c) => c.step !== "financial" && (c.status === "warn" || c.status === "fail"))).toEqual([]);
  });
});
