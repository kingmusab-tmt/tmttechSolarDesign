import { describe, expect, it } from "vitest";
import { LGAS } from "./lgas";
import { NIGERIAN_STATES, findLocation, matchLga, matchState, siteForState } from "./locations";

describe("states and LGAs", () => {
  it("lists the 36 states, the FCT and all 774 LGAs", () => {
    expect(NIGERIAN_STATES).toHaveLength(37);
    expect(Object.keys(LGAS).sort()).toEqual(NIGERIAN_STATES.map((s) => s.name).sort());
    expect(Object.values(LGAS).flat()).toHaveLength(774);
  });

  it("links every state preset to a real city preset in that state", () => {
    for (const st of NIGERIAN_STATES.filter((s) => s.presetKey)) expect(findLocation(st.presetKey!)?.state).toBe(st.name);
  });

  it("starts a state without a preset at its capital", () => {
    const site = siteForState(NIGERIAN_STATES.find((s) => s.name === "Abia")!);
    expect(site).toMatchObject({ locationPreset: "custom", city: "Umuahia", state: "Abia" });
  });
});

describe("matchState / matchLga", () => {
  it("maps outside state names onto ours", () => {
    expect(matchState("Lagos State")).toBe("Lagos");
    expect(matchState("Federal Capital Territory")).toBe("FCT");
    expect(matchState("Akwa-Ibom")).toBe("Akwa Ibom");
    expect(matchState("Atlantis")).toBe("");
  });

  it("maps outside LGA names onto ours, keeping unknown names", () => {
    expect(matchLga("Lagos", "Eti-Osa")).toBe("Eti Osa");
    expect(matchLga("Lagos", "Somolu")).toBe("Shomolu");
    expect(matchLga("FCT", "Abuja Municipal Area Council")).toBe("Municipal Area Council");
    expect(matchLga("Rivers", "Obio-Akpor LGA")).toBe("Obio/Akpor");
    expect(matchLga("Lagos", "Nowhere")).toBe("Nowhere");
  });
});
