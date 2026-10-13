import { describe, expect, it } from "vitest";
import { diffValues, isDefaultSection, sameValue, sectionWriteMode, STEP_SECTIONS } from "./collab";
import { defaultInputs, STEP_KEYS } from "./schemas";

describe("section write rules", () => {
  const base = { shared: true, userId: "bob" };
  it("personal projects are always edited directly", () => {
    expect(sectionWriteMode({ ...base, shared: false, section: "battery", ownerOfSection: "ada" })).toBe("direct");
  });
  it("anyone can add information to a section nobody has created yet", () => {
    expect(sectionWriteMode({ ...base, section: "battery" })).toBe("direct");
  });
  it("the creator edits their own section directly", () => {
    expect(sectionWriteMode({ ...base, section: "battery", ownerOfSection: "bob" })).toBe("direct");
  });
  it("editing someone else's section requires approval", () => {
    expect(sectionWriteMode({ ...base, section: "battery", ownerOfSection: "ada" })).toBe("approval");
  });
  it("progress ticks are review actions open to every member", () => {
    expect(sectionWriteMode({ ...base, section: "progress", ownerOfSection: "ada" })).toBe("direct");
  });
});

describe("default detection", () => {
  it("treats untouched sections as defaults and edited ones as information", () => {
    const d = defaultInputs();
    expect(isDefaultSection("battery", d.battery)).toBe(true);
    expect(isDefaultSection("loads", [])).toBe(true);
    expect(isDefaultSection("battery", { ...d.battery, daysOfAutonomy: 2 })).toBe(false);
  });
  it("compares values regardless of key order", () => {
    expect(sameValue({ a: 1, b: [1, { c: 2, d: 3 }] }, { b: [1, { d: 3, c: 2 }], a: 1 })).toBe(true);
  });
});

describe("change diff for reviewers", () => {
  it("reports changed fields with their paths", () => {
    const d = diffValues({ dod: 0.9, daysOfAutonomy: 1, chemistry: "lifepo4" }, { dod: 0.9, daysOfAutonomy: 2, chemistry: "lifepo4" });
    expect(d).toEqual([{ path: "daysOfAutonomy", before: 1, after: 2, kind: "changed" }]);
  });
  it("matches list items by id: added, removed and edited appliances", () => {
    const before = [
      { id: "a", name: "Fridge", watts: 150 },
      { id: "b", name: "TV", watts: 80 },
    ];
    const after = [
      { id: "a", name: "Fridge", watts: 200 },
      { id: "c", name: "Fan", watts: 75 },
    ];
    const d = diffValues(before, after);
    expect(d).toContainEqual({ path: "[TV]", before: before[1], after: undefined, kind: "removed" });
    expect(d).toContainEqual({ path: "[Fan]", before: undefined, after: after[1], kind: "added" });
    expect(d).toContainEqual({ path: "[Fridge].watts", before: 150, after: 200, kind: "changed" });
  });
});

describe("step locks", () => {
  it("every step maps to the sections its form edits", () => {
    for (const s of STEP_KEYS) expect(Array.isArray(STEP_SECTIONS[s])).toBe(true);
    expect(STEP_SECTIONS.strings).toContain("site"); // the strings step edits site temperatures too
  });
});
