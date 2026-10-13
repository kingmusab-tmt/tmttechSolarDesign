import { describe, expect, it } from "vitest";
import { sampleLoads } from "./appliances";
import { computeDesign } from "./calc";
import { EQUIPMENT_SEED, type SeedItem } from "./equipment-seed";
import { BatterySchema, ControllerSchema, InverterSpecSchema, PanelSpecSchema, defaultInputs, type DesignInputs } from "./schemas";

const nums = (s: SeedItem["specs"]) => Object.fromEntries(Object.entries(s).filter(([, v]) => typeof v === "number")) as Record<string, number>;
const find = (key: string) => EQUIPMENT_SEED.find((e) => e.seedKey === key)!;

describe("built-in equipment library", () => {
  it("has unique seed keys", () => {
    const keys = EQUIPMENT_SEED.map((e) => e.seedKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every verified item cites an official datasheet", () => {
    const verified = EQUIPMENT_SEED.filter((e) => e.verified);
    expect(verified.length).toBeGreaterThanOrEqual(14);
    for (const e of verified) {
      expect(e.datasheetUrl).toMatch(/^https:\/\/.+\.pdf$/);
      expect(e.brand).not.toBe("Generic");
    }
  });

  it("every item parses against the design schema for its type", () => {
    for (const e of EQUIPMENT_SEED) {
      const specs = nums(e.specs);
      const schema = { panel: PanelSpecSchema, inverter: InverterSpecSchema, battery: BatterySchema, controller: ControllerSchema }[e.type];
      const r = schema.safeParse(e.type === "battery" ? { ...specs, chemistry: e.specs.chemistry } : specs);
      expect(r.success, `${e.seedKey}: ${r.success ? "" : r.error.issues[0]?.message}`).toBe(true);
    }
  });

  it("includes at least 15 verified real modules from several manufacturers", () => {
    const panels = EQUIPMENT_SEED.filter((e) => e.type === "panel" && e.verified);
    expect(panels.length).toBeGreaterThanOrEqual(15);
    expect(new Set(panels.map((p) => p.brand)).size).toBeGreaterThanOrEqual(4);
    expect(new Set(panels.map((p) => p.model)).size).toBe(panels.length);
  });

  it("every verified module's datasheet values are internally consistent (catches transcription errors)", () => {
    for (const p of EQUIPMENT_SEED.filter((e) => e.type === "panel" && e.verified)) {
      const s = p.specs as Record<string, number>;
      // Rated power must equal Vmp × Imp within datasheet rounding.
      expect(Math.abs(s.vmpV * s.impA - s.pmaxW) / s.pmaxW, `${p.model}: Vmp×Imp ${(s.vmpV * s.impA).toFixed(1)} vs ${s.pmaxW}`).toBeLessThan(0.01);
      expect(s.vocV, p.model).toBeGreaterThan(s.vmpV);
      expect(s.iscA, p.model).toBeGreaterThan(s.impA);
      expect(s.betaVocPct, p.model).toBeLessThan(0);
      expect(s.gammaPmaxPct, p.model).toBeLessThan(s.betaVocPct); // power falls faster than voltage with heat
      expect(s.lengthM * s.widthM * 1000 * 0.18, `${p.model}: efficiency below 18 %`).toBeLessThan(s.pmaxW);
    }
  });

  it("inverter/chargers without MPPT are flagged so the design switches to standalone", () => {
    for (const e of EQUIPMENT_SEED.filter((x) => x.type === "inverter")) {
      if (e.specs.maxPvVoltage === 0) expect(e.specs.kind).toBe("inverter_charger");
      else expect(e.specs.kind).toBe("hybrid");
    }
  });
});

function design(mutate: (d: DesignInputs) => void) {
  const d = defaultInputs();
  d.loads = sampleLoads();
  mutate(d);
  return computeDesign(d);
}

describe("designs built from verified equipment", () => {
  it("Deye SUN-5K hybrid + Pylontech US5000 passes every engineering check", () => {
    const inv = find("deye-sun-5k-sg04lp1-eu");
    const bat = find("pylontech-us5000");
    const r = design((d) => {
      d.inverter = { ...d.inverter, type: "hybrid", systemVoltage: 48, selected: { ...d.inverter.selected, ...nums(inv.specs), brand: inv.brand, model: inv.model } };
      d.battery = { ...d.battery, ...nums(bat.specs), chemistry: "lifepo4" };
    });
    expect(r.inverter.isSelected).toBe(true);
    expect(r.strings.device.maxDcVoltage).toBe(500);
    expect(r.battery.bankVoltage).toBe(48);
    expect(r.checks.filter((c) => c.step !== "financial" && (c.status === "fail" || c.status === "warn"))).toEqual([]);
  });

  it("Victron MultiPlus-II + SmartSolar 250/70 (standalone) sizes strings against the controller", () => {
    const inv = find("victron-multiplus-ii-48-5000-70-50");
    const cc = find("victron-smartsolar-250-70");
    const r = design((d) => {
      d.inverter = { ...d.inverter, type: "standalone", systemVoltage: 48, selected: { ...d.inverter.selected, ...nums(inv.specs) } };
      d.controller = { ...d.controller, ...nums(cc.specs) };
    });
    expect(r.controller.applicable).toBe(true);
    expect(r.strings.device.maxDcVoltage).toBe(250);
    expect(r.strings.stringVocCold).toBeLessThanOrEqual(250);
    expect(r.checks.filter((c) => c.status === "fail")).toEqual([]);
  });
});
