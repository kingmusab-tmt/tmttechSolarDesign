import { pinMatch } from "../postcode";
import type { DesignInputs } from "../schemas";
import type { BoqResult } from "./boq";
import type { InverterResult, ControllerResult } from "./sizing";
import { check, type Check } from "./types";

/*
 * Design readiness: flags inputs that are still placeholders, so a design is not issued for
 * construction on generic equipment, default prices or preset climate data.
 */
export function readinessChecks(d: DesignInputs, x: { inverter: InverterResult; controller: ControllerResult; boq: BoqResult }): Check[] {
  const generic = (brand: string, model: string) => !brand.trim() || /generic/i.test(brand) || !model.trim();
  const placeholders: string[] = [];
  if (generic(d.pv.panel.brand, d.pv.panel.model)) placeholders.push("PV module");
  if (!x.inverter.isSelected) placeholders.push("inverter");
  if (generic(d.battery.brand, d.battery.model)) placeholders.push("battery");
  if (x.controller.applicable && generic(d.controller.brand, d.controller.model)) placeholders.push("charge controller");

  const autoItems = x.boq.items.filter((i) => i.auto);
  const priced = autoItems.filter((i) => d.boq.prices[i.key] !== undefined).length;
  const majors = ["pv_module", "inverter", "battery"].filter((k) => autoItems.some((i) => i.key === k));
  const majorsPriced = majors.filter((k) => d.boq.prices[k] !== undefined).length;

  const presetClimate = /preset/i.test(d.site.climateSource) || d.site.monthlyPsh.length !== 12;
  const np = d.site.nipost;
  const match = pinMatch(np.postcode, np.pinPostcode, np.pinChecked);
  const nipostCheck =
    d.site.locationMethod === "nipost"
      ? [
          check(
            "report",
            "rd-nipost",
            "Site building identified and verified by NIPOST postcode",
            np.source !== "" && match === "matched",
            np.source === ""
              ? "Pin the building in Project & Site (GPS, map or the client's location link)"
              : match === "matched"
                ? `${np.postcode}, pinned location verified by NIPOST`
                : match === "mismatch"
                  ? `The pin is on ${np.pinPostcode}, not ${np.postcode || "the entered postcode"}: move the pin or correct the postcode`
                  : match === "no_building"
                    ? "NIPOST found no building at the pin: check the pin is on the roof"
                    : "Location not cross-checked with NIPOST yet",
            "warn",
          ),
        ]
      : [];

  return [
    ...nipostCheck,
    check("report", "rd-equipment", "Real equipment selected (no generic placeholders)", placeholders.length === 0, placeholders.length ? `Still generic: ${placeholders.join(", ")}. Pick real models from the equipment library so the checks use their datasheet values.` : "Every major component is a specific make and model", "warn"),
    check("report", "rd-prices", "Main prices updated from supplier quotes", majors.length === 0 || majorsPriced === majors.length, `${priced} of ${autoItems.length} BoQ prices entered${majorsPriced < majors.length ? "; module, inverter and battery prices are still indicative defaults" : ""}`, "warn"),
    check("report", "rd-climate", "Site climate data from NASA POWER / Global Solar Atlas", !presetClimate, presetClimate ? "Using a location preset; fetch NASA POWER in Project & Site for 12-month data and record temperatures" : d.site.climateSource, "warn"),
    check("report", "rd-site", "Site surveyed (earth resistance measured)", d.assessment.earthResistanceOhm > 0, d.assessment.earthResistanceOhm > 0 ? `Earth resistance ${d.assessment.earthResistanceOhm} Ω measured at survey` : "Measure the existing earth resistance during the site survey (Site Assessment)", "warn"),
    check("report", "rd-engineer", "Design engineer and COREN number recorded", Boolean(d.compliance.engineerName.trim() && d.compliance.corenNumber.trim()), d.compliance.engineerName && d.compliance.corenNumber ? `${d.compliance.engineerName}, COREN ${d.compliance.corenNumber}` : "Enter them in Code Compliance before issuing the design", "warn"),
  ];
}
