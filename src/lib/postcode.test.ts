import { describe, expect, it } from "vitest";
import { canonicalPostcode, distanceM, inNigeria, parsePostcode, pinMatch } from "./postcode";

describe("parsePostcode", () => {
  it("accepts hyphenated, spaced and compact input in any case", () => {
    for (const input of ["EK-01-A03-FK-01", "EK 01 A03 FK 01", "ek01a03fk01", " ek-01 a03-fk 01 "]) {
      expect(parsePostcode(input)).toMatchObject({ state: "EK", lga: "01", district: "A03", area: "FK", unit: "01", formatted: "EK-01-A03-FK-01", compact: "EK01A03FK01" });
    }
  });

  it("rejects malformed codes", () => {
    for (const input of ["", "100001", "EK-01-A03-FK", "EK-01-A03-FK-011", "E1-01-A03-FK-01", "EK-0A-A03-FK-01", "EK-01-A03-F1-01", "EK-00-A03-FK-01", "EK-01-A03-FK-00", "TP-12345"]) {
      expect(parsePostcode(input)).toBeNull();
    }
  });

  it("canonicalises for comparison", () => {
    expect(canonicalPostcode("fc02a09db09")).toBe("FC-02-A09-DB-09");
    expect(canonicalPostcode("nonsense")).toBe("");
  });
});

describe("pinMatch", () => {
  it("compares the entered postcode with the pinned building", () => {
    expect(pinMatch("FC-02-A09-DB-09", "FC02A09DB09", true)).toBe("matched");
    expect(pinMatch("FC-02-A09-DB-09", "FC-02-A09-DB-07", true)).toBe("mismatch");
    expect(pinMatch("", "FC-02-A09-DB-07", true)).toBe("mismatch");
    expect(pinMatch("FC-02-A09-DB-09", "", true)).toBe("no_building");
    expect(pinMatch("FC-02-A09-DB-09", "", false)).toBe("unchecked");
  });
});

describe("geometry helpers", () => {
  it("measures distances in metres", () => {
    // 0.001° of latitude ≈ 111 m
    expect(distanceM(9, 7, 9.001, 7)).toBeCloseTo(111.2, 0);
  });

  it("knows Nigeria's extent", () => {
    expect(inNigeria(9.0765, 7.3986)).toBe(true); // Abuja
    expect(inNigeria(51.5, -0.12)).toBe(false); // London
  });
});
