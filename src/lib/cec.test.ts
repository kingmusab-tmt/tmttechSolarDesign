import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MODULE_KG_PER_M2, rowToModule, searchModules, type CecRow } from "./cec";

const data = JSON.parse(readFileSync("src/data/cec-modules.json", "utf8")) as { fields: string[]; rows: CecRow[] };

describe("bundled CEC module database", () => {
  it("contains the full list with every field string sizing needs", () => {
    expect(data.rows.length).toBeGreaterThan(20000);
    expect(data.fields).toEqual(["manufacturer", "model", "technology", "bifacial", "pmaxW", "vocV", "vmpV", "iscA", "impA", "betaVocPct", "gammaPmaxPct", "noctC", "lengthM", "widthM", "dimsEstimated"]);
    for (const r of data.rows.slice(0, 500)) {
      const m = rowToModule(r, 0);
      expect(m.specs.vocV).toBeGreaterThan(m.specs.vmpV);
      expect(m.specs.iscA).toBeGreaterThanOrEqual(m.specs.impA);
      expect(m.specs.betaVocPct).toBeLessThan(0);
      expect(m.specs.lengthM).toBeGreaterThan(0);
    }
  });

  it("converts the Voc coefficient from V/K to %/°C (Jinko JKM505N: datasheet −0.25 %/°C)", () => {
    const { items } = searchModules(data.rows, "jinko JKM505N-72HL4-TV");
    expect(items[0].specs.vocV).toBe(49.51);
    expect(items[0].specs.betaVocPct).toBeCloseTo(-0.26, 1);
    expect(items[0].specs.pmaxW).toBe(505);
  });

  it("estimates weight from area and derives missing dimensions at a 2:1 ratio", () => {
    const m = searchModules(data.rows, "jinko JKM505N-72HL4-TV").items[0];
    expect(m.dimsEstimated).toBe(true);
    expect(m.specs.lengthM / m.specs.widthM).toBeCloseTo(2, 1);
    expect(m.specs.weightKg).toBeCloseTo(m.specs.lengthM * m.specs.widthM * MODULE_KG_PER_M2, 0);
  });

  it("searches by manufacturer, model fragments and wattage range", () => {
    const longi = searchModules(data.rows, "longi", { minW: 540, maxW: 560, limit: 100 });
    expect(longi.total).toBeGreaterThan(0);
    expect(longi.items.every((m) => /longi/i.test(m.manufacturer) && m.specs.pmaxW >= 540 && m.specs.pmaxW <= 560)).toBe(true);
    expect(searchModules(data.rows, "zzzz-no-such-module").total).toBe(0);
    expect(searchModules(data.rows, "jinko", { limit: 5 }).items).toHaveLength(5);
  });
});
