import { describe, expect, it } from "vitest";
import { defaultInputs, PanelSpecSchema, StringsSchema } from "../schemas";
import { minCrossSection, selectCable } from "./cables";
import { ambientFactor, groupingFactor } from "./constants";
import { insulationLimits } from "./commissioning";
import { hourlyLoad, simulateYear } from "./simulation";
import { maintenancePlan } from "./handover";
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
    expect(r.checks.filter((c) => c.step !== "report" && (c.status === "warn" || c.status === "fail"))).toEqual([]);
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
    expect(r.checks.filter((c) => c.step !== "financial" && c.step !== "report" && (c.status === "warn" || c.status === "fail"))).toEqual([]);
  });
});

describe("cable derating (IEC 60364-5-52)", () => {
  it("ambient factors match Table B.52.14 for XLPE (90 °C)", () => {
    expect(ambientFactor(30, 90)).toBeCloseTo(1, 3);
    expect(ambientFactor(40, 90)).toBeCloseTo(0.91, 2);
    expect(ambientFactor(50, 90)).toBeCloseTo(0.82, 2);
    expect(ambientFactor(95, 90)).toBe(0);
  });

  it("grouping factors follow Table B.52.17", () => {
    expect(groupingFactor(1)).toBe(1);
    expect(groupingFactor(3)).toBe(0.7);
    expect(groupingFactor(10)).toBe(0.5);
  });

  it("derating can force a larger cable for the same protective device", () => {
    expect(selectCable(2, 20, 32, 230, 5, 1.5, 1).sizeMm2).toBe(2.5);
    expect(selectCable(2, 20, 32, 230, 5, 1.5, 0.7).sizeMm2).toBe(6);
  });

  it("every designed cable satisfies Iz ≥ In after derating", () => {
    const r = computeDesign(defaultInputs());
    for (const s of r.cables.segments) expect(s.ampacityA).toBeGreaterThanOrEqual(s.protectionA);
    const string = r.cables.segments.find((s) => s.key === "pv_string")!;
    expect(string.derating.ambientC).toBe(70);
    expect(string.derating.conductorMaxC).toBe(120);
  });
});

describe("mounting structure and wind uplift", () => {
  const withLoads = () => {
    const d = defaultInputs();
    d.loads = [{ id: "1", name: "Load", category: "Other", watts: 500, qty: 1, hoursPerDay: 8, inductive: false, surgeFactor: 1 }];
    d.assessment.roofLengthM = 12;
    d.assessment.roofWidthM = 12;
    return d;
  };
  const keys = (r: ReturnType<typeof computeDesign>) => r.boq.items.map((i) => i.key);

  it("pitched roofs use roof hooks and check them against uplift", () => {
    const d = withLoads();
    d.layout.mountType = "gable";
    const r = computeDesign(d);
    expect(keys(r)).toContain("roof_hook");
    expect(keys(r)).not.toContain("tilt_frame");
    expect(r.structure.anchors).toBe(r.layout.roofAttachments);
    expect(r.checks.find((c) => c.id === "st-fixings")).toBeDefined();
  });

  it("ballasted flat roofs get tilt frames, enough ballast and a roof-load check", () => {
    const d = withLoads();
    d.layout.mountType = "flat";
    const r = computeDesign(d);
    const s = r.structure;
    expect(s.frames).toBeGreaterThan(0);
    expect(s.ballastKg).toBeGreaterThan(0);
    // ballast + array weight resists the factored uplift
    const arrayKg = r.strings.totalPanels * d.pv.panel.weightKg + d.assessment.mountingWeightKgM2 * r.strings.totalPanels * d.pv.panel.lengthM * d.pv.panel.widthM;
    expect(((s.ballastKg + arrayKg) * 9.81) / 1000).toBeGreaterThanOrEqual(1.5 * s.upliftKN - 1e-6);
    expect(keys(r)).toEqual(expect.arrayContaining(["tilt_frame", "ballast"]));
    expect(keys(r)).not.toContain("roof_hook");
    expect(r.checks.find((c) => c.id === "st-roof-load")).toBeDefined();
  });

  it("ground mounts get posts and footings deep enough for the uplift", () => {
    const d = withLoads();
    d.layout.mountType = "ground";
    const r = computeDesign(d);
    const s = r.structure;
    expect(s.posts).toBe(2 * s.frames);
    expect(s.footingDepthM).toBeGreaterThanOrEqual(0.6);
    expect(s.fixingCapacityKN).toBeGreaterThanOrEqual(s.designUpliftPerFixingKN);
    expect(keys(r)).toEqual(expect.arrayContaining(["ground_post", "footing_concrete"]));
  });

  it("tilted rows are spaced so they don't shade each other", () => {
    const d = withLoads();
    d.layout.mountType = "flat";
    const r = computeDesign(d);
    expect(r.structure.rowPitchM).toBeGreaterThan(r.layout.moduleH * Math.cos((r.structure.tiltDeg * Math.PI) / 180));
  });
});

describe("commissioning tests (IEC 62446-1)", () => {
  it("picks the insulation test voltage and limit from the array voltage", () => {
    expect(insulationLimits(100)).toEqual({ testV: 250, minMOhm: 0.5 });
    expect(insulationLimits(400)).toEqual({ testV: 500, minMOhm: 1 });
    expect(insulationLimits(700)).toEqual({ testV: 1000, minMOhm: 1 });
  });

  it("corrects expected Voc for module temperature and Isc for irradiance", () => {
    const d = defaultInputs();
    d.loads = [{ id: "1", name: "Load", category: "Other", watts: 500, qty: 1, hoursPerDay: 8, inductive: false, surgeFactor: 1 }];
    const base = computeDesign(d);
    const series = base.strings.series;
    const p = d.pv.panel;
    const expectedVoc = series * p.vocV * (1 + (p.betaVocPct / 100) * (50 - 25));
    d.handover.stringTests = {
      S1: { vocV: expectedVoc * 1.02, cellTempC: 50, iscA: p.iscA * 0.8, irradianceWm2: 800, polarityOk: true, insulationMOhm: 50 },
    };
    d.handover.earthOhm = 12;
    const r = computeDesign(d).commissioning;
    expect(r.strings[0].expectedVocV).toBeCloseTo(expectedVoc, 6);
    expect(r.strings[0].voc).toBe("pass");
    expect(r.strings[0].isc).toBe("pass");
    expect(r.strings[0].insulation).toBe("pass");
    expect(r.earth).toBe("fail");
    expect(r.allPassed).toBe(false);
  });

  it("flags a string with a missing module (Voc too low)", () => {
    const d = defaultInputs();
    d.loads = [{ id: "1", name: "Load", category: "Other", watts: 1500, qty: 2, hoursPerDay: 8, inductive: false, surgeFactor: 1 }];
    const series = computeDesign(d).strings.series;
    expect(series).toBeGreaterThan(1);
    d.handover.stringTests = { S1: { vocV: (series - 1) * d.pv.panel.vocV, cellTempC: 25, iscA: 0, irradianceWm2: 0, polarityOk: true, insulationMOhm: 0 } };
    const r = computeDesign(d);
    expect(r.commissioning.strings[0].voc).toBe("fail");
    expect(r.checks.find((c) => c.id === "hv-voc")?.status).toBe("fail");
  });
});

describe("essential-loads distribution board", () => {
  const load = (name: string, category: string, watts: number, qty = 1, inductive = false) => ({ id: name, name, category, watts, qty, hoursPerDay: 4, inductive, surgeFactor: inductive ? 3 : 1 });

  it("puts lighting, general appliances and heavy loads on suitable circuits", () => {
    const d = defaultInputs();
    d.loads = [load("LED", "Lighting", 10, 30), load("TV", "Entertainment", 120, 2), load("Laptop", "Office/IT", 65, 3), load("Air conditioner", "Cooling", 1200, 1, true), load("Pump", "Pumping", 750, 1, true)];
    const r = computeDesign(d).distribution;
    const lighting = r.circuits.filter((c) => c.kind === "lighting");
    expect(lighting.length).toBe(1);
    expect(lighting[0].cableMm2).toBeGreaterThanOrEqual(1.5);
    expect(lighting[0].curve).toBe("B");
    const dedicated = r.circuits.filter((c) => c.kind === "dedicated");
    expect(dedicated.map((c) => c.loads[0]).sort()).toEqual(["Air conditioner", "Pump"]);
    expect(dedicated.every((c) => c.curve === "C")).toBe(true);
    for (const c of r.circuits) {
      expect(c.ampacityA).toBeGreaterThanOrEqual(c.mcbA);
      expect(c.mcbA).toBeGreaterThanOrEqual(c.designA);
    }
    expect(r.boardWays).toBeGreaterThanOrEqual(r.waysUsed);
  });

  it("splits lighting over several circuits when it exceeds one circuit", () => {
    const d = defaultInputs();
    d.loads = [load("Flood light", "Lighting", 200, 8)];
    const r = computeDesign(d).distribution;
    expect(r.circuits.filter((c) => c.kind === "lighting").length).toBe(2);
    expect(r.circuits.every((c) => c.connectedW <= 1000)).toBe(true);
  });
});

describe("year-round battery simulation", () => {
  const loads = [
    { id: "1", name: "LED", category: "Lighting", watts: 10, qty: 10, hoursPerDay: 6, inductive: false, surgeFactor: 1 },
    { id: "2", name: "Fridge", category: "Refrigeration", watts: 150, qty: 1, hoursPerDay: 24, inductive: true, surgeFactor: 3 },
    { id: "3", name: "TV", category: "Entertainment", watts: 100, qty: 1, hoursPerDay: 5, inductive: false, surgeFactor: 1 },
  ];
  const dailyWh = 600 + 3600 + 500;
  const base = { loads, dailyWh, dailyYieldKWhPerPsh: 1.4, monthlyPsh: new Array(12).fill(5), roundTrip: 0.95, backupAvailable: false };

  it("spreads the load over the day without changing its energy", () => {
    const h = hourlyLoad(loads, dailyWh);
    expect(h.reduce((a, b) => a + b, 0)).toBeCloseTo(dailyWh / 1000, 9);
    expect(h[20]).toBeGreaterThan(h[3]); // lights in the evening
  });

  it("balances energy: PV − surplus − losses + backup = load", () => {
    const r = simulateYear({ ...base, usableKWh: 6 }).annual;
    const losses = r.pvKWh - r.surplusKWh + r.backupKWh - r.loadKWh;
    expect(r.loadKWh).toBeCloseTo((dailyWh / 1000) * 365, 6);
    expect(losses).toBeGreaterThanOrEqual(-1e-6); // round-trip losses can only consume energy
    expect(losses).toBeLessThan(0.1 * r.loadKWh);
  });

  it("more battery means less backup energy, and too little PV can't be fixed by batteries alone", () => {
    const small = simulateYear({ ...base, usableKWh: 2 }).annual;
    const large = simulateYear({ ...base, usableKWh: 12 }).annual;
    expect(large.backupKWh).toBeLessThan(small.backupKWh);
    const starved = simulateYear({ ...base, dailyYieldKWhPerPsh: 0.5, usableKWh: 50 });
    expect(starved.annual.solarFractionPct).toBeLessThan(80);
    expect(starved.checks[0].status).toBe("fail");
  });

  it("is repeatable", () => {
    expect(simulateYear({ ...base, usableKWh: 4 }).annual).toEqual(simulateYear({ ...base, usableKWh: 4 }).annual);
  });
});

describe("fault level and lightning screening", () => {
  const design = (patch: (d: ReturnType<typeof defaultInputs>) => void) => {
    const d = defaultInputs();
    d.loads = [{ id: "1", name: "Load", category: "Other", watts: 800, qty: 1, hoursPerDay: 8, inductive: false, surgeFactor: 1 }];
    patch(d);
    return computeDesign(d);
  };

  it("sizes the battery device's breaking capacity from the bank's fault current", () => {
    const r = design((d) => (d.battery.chemistry = "lifepo4"));
    expect(r.protection.batteryIscKA).toBeCloseTo((20 * r.battery.bankAh) / 1000, 6);
    expect(r.protection.batteryBreakingKA).toBeGreaterThanOrEqual(r.protection.batteryIscKA);
    expect(r.checks.find((c) => c.id === "pr-battery-isc")?.status).toBe("pass");
  });

  it("collection area and strike frequency follow IEC 62305-2", () => {
    const r = design((d) => {
      d.layout.mountType = "flat";
      d.assessment.roofLengthM = 10;
      d.assessment.roofWidthM = 8;
      d.assessment.buildingHeightM = 5;
      d.assessment.groundFlashDensity = 12;
      d.assessment.surroundings = "isolated";
    });
    const ad = 10 * 8 + 2 * 15 * 18 + Math.PI * 15 * 15;
    expect(r.protection.lightning.adM2).toBeCloseTo(ad, 6);
    expect(r.protection.lightning.nd).toBeCloseTo(12 * ad * 1e-6, 9);
  });

  it("recommends an external LPS only for high strike frequency", () => {
    const tall = design((d) => {
      d.assessment.buildingHeightM = 25;
      d.assessment.groundFlashDensity = 30;
      d.assessment.surroundings = "hilltop";
    });
    expect(tall.protection.lightning.lps).toBe(true);
    expect(tall.boq.items.map((i) => i.key)).toContain("lps");
    const house = design(() => undefined);
    expect(house.protection.lightning.lps).toBe(false);
  });
});

describe("grid connection and handover", () => {
  const base = () => {
    const d = defaultInputs();
    d.loads = [{ id: "1", name: "Load", category: "Other", watts: 800, qty: 1, hoursPerDay: 8, inductive: false, surgeFactor: 1 }];
    return d;
  };

  it("doesn't report post-installation items during design", () => {
    const r = computeDesign(base());
    expect(r.checks.some((c) => c.step === "handover")).toBe(false);
  });

  it("tracks the export checklist and limit once handover has started", () => {
    const d = base();
    d.site.gridAvailable = true;
    d.handover.grid.connection = "export";
    d.handover.grid.steps = { application: true };
    const r = computeDesign(d);
    expect(r.grid.mode).toBe("export");
    expect(r.checks.find((c) => c.id === "gr-steps")?.status).toBe("warn");
    expect(r.checks.find((c) => c.id === "gr-limit")?.status).toBe("warn");
  });

  it("treats a site without grid as off-grid regardless of the setting", () => {
    const d = base();
    d.site.gridAvailable = false;
    d.handover.grid.connection = "export";
    expect(computeDesign(d).grid.mode).toBe("none");
  });

  it("adds electrolyte checks for flooded batteries and plans replacements", () => {
    const flooded = maintenancePlan({ battery: { ...base().battery, chemistry: "lead_acid" }, batteryLifeYears: 3, inverterLifeYears: 10, hasController: true, ground: false });
    expect(flooded.some((t) => /electrolyte/i.test(t.task))).toBe(true);
    expect(flooded.some((t) => t.interval === "Year 3")).toBe(true);
    const lfp = maintenancePlan({ battery: { ...base().battery, chemistry: "lifepo4" }, batteryLifeYears: 10, inverterLifeYears: 10, hasController: false, ground: true });
    expect(lfp.some((t) => /electrolyte/i.test(t.task))).toBe(false);
  });
});

describe("installation schedules", () => {
  it("tags every cable uniquely and lists every string with its modules and input", () => {
    const d = defaultInputs();
    d.loads = [{ id: "1", name: "Load", category: "Other", watts: 1500, qty: 2, hoursPerDay: 8, inductive: false, surgeFactor: 1 }];
    d.assessment.roofLengthM = 20;
    d.assessment.roofWidthM = 10;
    const r = computeDesign(d);
    const tags = r.schedules.cables.map((c) => c.tag);
    expect(new Set(tags).size).toBe(tags.length);
    expect(r.schedules.cables.filter((c) => c.from.startsWith("String")).length).toBe(r.strings.parallel);
    expect(r.schedules.cables.filter((c) => c.from.startsWith("Essential-loads board")).length).toBe(r.distribution.circuits.length);
    expect(r.schedules.strings.length).toBe(r.strings.parallel);
    for (const s of r.schedules.strings) {
      const count = s.positions.split("; ").reduce((a, part) => {
        const m = part.match(/modules (\d+)–(\d+)|module (\d+)/);
        return a + (m ? (m[3] ? 1 : Number(m[2]) - Number(m[1]) + 1) : 0);
      }, 0);
      expect(count).toBe(r.strings.series);
    }
  });
});

describe("design readiness", () => {
  it("flags generic equipment, default prices and preset climate, then clears when filled in", () => {
    const d = defaultInputs();
    d.loads = [{ id: "1", name: "Load", category: "Other", watts: 800, qty: 1, hoursPerDay: 8, inductive: false, surgeFactor: 1 }];
    const ids = (r: ReturnType<typeof computeDesign>) => r.checks.filter((c) => c.step === "report" && c.status !== "pass").map((c) => c.id);
    expect(ids(computeDesign(d))).toEqual(expect.arrayContaining(["rd-equipment", "rd-prices", "rd-climate", "rd-site", "rd-engineer"]));

    d.pv.panel.brand = "Jinko";
    d.pv.panel.model = "JKM450M-60HL4";
    d.battery.brand = "Pylontech";
    d.battery.model = "US5000";
    d.inverter.selected.ratedPowerW = 5000;
    d.boq.prices = { pv_module: 120000, inverter: 900000, battery: 1500000 };
    d.site.monthlyPsh = new Array(12).fill(5);
    d.site.climateSource = "NASA POWER · 9.05°, 7.49°";
    d.assessment.earthResistanceOhm = 6;
    d.compliance.engineerName = "Engr. A. Bello";
    d.compliance.corenNumber = "R.12345";
    expect(ids(computeDesign(d))).toEqual([]);
  });
});
