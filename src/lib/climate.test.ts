import { describe, expect, it } from "vitest";
import { combineClimate, parseNasaPower, parsePastedMonthly } from "./climate";
import { revisionLabel } from "./revision-label";

const sample = {
  properties: {
    parameter: {
      ALLSKY_SFC_SW_DWN: { JAN: 4.92, FEB: 4.79, MAR: 4.98, APR: 5.03, MAY: 4.68, JUN: 3.95, JUL: 3.82, AUG: 4.11, SEP: 4.2, OCT: 4.65, NOV: 5.02, DEC: 4.96, ANN: 4.59 },
      T2M_MAX: { JAN: 31.3, FEB: 32.18, MAR: 32.13, APR: 32.38, MAY: 31.03, JUN: 30.35, JUL: 28.91, AUG: 28.42, SEP: 29.77, OCT: 30.88, NOV: 31.39, DEC: 31.4, ANN: 32.38 },
      T2M_MIN: { JAN: 15.17, FEB: 17.96, MAR: 21.12, APR: 24.51, MAY: 24.15, JUN: 23.16, JUL: 21.79, AUG: 20.98, SEP: 22.21, OCT: 23.19, NOV: 22.52, DEC: 18.01, ANN: 15.17 },
    },
  },
};

// Monthly GHI totals (kWh/m²) as shown on Global Solar Atlas for 7.770874, 4.542390 (Osogbo).
const GSA_GHI_TOTALS = "147.56 140.48 157.08 154.5 157.11 138.81 121.43 112.47 129.36 147.06 160.53 159.09 1725.48";

describe("NASA POWER parsing", () => {
  it("extracts the monthly profile and outward-rounded extremes", () => {
    const c = parseNasaPower(sample);
    expect(c.monthlyPsh).toHaveLength(12);
    expect(c.annualPsh).toBe(4.59);
    expect(c.tMin).toBe(15);
    expect(c.tMax).toBe(33);
  });
  it("rejects fill values and malformed responses", () => {
    const bad = structuredClone(sample);
    bad.properties.parameter.ALLSKY_SFC_SW_DWN.JUL = -999;
    expect(() => parseNasaPower(bad)).toThrow();
    expect(() => parseNasaPower({})).toThrow();
  });
});

describe("pasted Global Solar Atlas values", () => {
  it("converts monthly totals (with a trailing annual total) to per-day values", () => {
    const r = parsePastedMonthly(GSA_GHI_TOTALS);
    expect(r.convertedFromTotals).toBe(true);
    expect(r.perDay[0]).toBeCloseTo(147.56 / 31, 2);
    expect(r.perDay[7]).toBeCloseTo(112.47 / 31, 2);
  });
  it("accepts per-day values separated by tabs, commas or new lines", () => {
    const r = parsePastedMonthly("4.76\t5.02, 5.07\n5.15 5.07 4.63 3.92 3.63 4.31 4.74 5.35 5.13");
    expect(r.convertedFromTotals).toBe(false);
    expect(r.perDay).toHaveLength(12);
    expect(r.perDay[7]).toBe(3.63);
  });
  it("rejects too few or too many values, and zeros", () => {
    expect(() => parsePastedMonthly("1 2 3")).toThrow(/12/);
    expect(() => parsePastedMonthly(Array(14).fill("5").join(" "))).toThrow();
    expect(() => parsePastedMonthly("0 5 5 5 5 5 5 5 5 5 5 5")).toThrow();
  });
});

describe("combining sources", () => {
  const gsa = parsePastedMonthly(GSA_GHI_TOTALS).perDay;
  const nasa = parseNasaPower(sample).monthlyPsh;
  it("averages both sources month by month", () => {
    const c = combineClimate(gsa, nasa);
    expect(c.method).toBe("average");
    c.monthlyPsh.forEach((v, i) => expect(v).toBeCloseTo((gsa[i] + nasa[i]) / 2, 1));
    expect(c.worstMonth.value).toBe(Math.min(...c.monthlyPsh));
  });
  it("uses NASA POWER alone when no atlas values are entered", () => {
    const c = combineClimate(null, nasa);
    expect(c.method).toBe("nasa");
    expect(c.monthlyPsh).toEqual(nasa);
  });
  it("uses the entered atlas values alone when NASA is unavailable", () => {
    expect(combineClimate(gsa, []).method).toBe("gsa");
  });
  it("flags months where the sources disagree by more than 15 %", () => {
    expect(combineClimate(gsa, nasa.map((v, i) => (i === 3 ? v * 1.5 : v))).disagreeMonths).toContain(3);
  });
  it("throws when neither source is available", () => {
    expect(() => combineClimate(null, null)).toThrow();
  });
});

describe("revision labels", () => {
  it("counts A..Z then AA", () => {
    expect([1, 2, 26, 27, 28].map(revisionLabel)).toEqual(["A", "B", "Z", "AA", "AB"]);
  });
});
