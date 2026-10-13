import { MONTH_LABELS as MONTH_NAMES } from "../climate";
import type { DesignInputs, StepKey } from "../schemas";
import { computeBoq, type BoqResult } from "./boq";
import { computeCables, type CableResult } from "./cables";
import { CHEMISTRY_INFO } from "./constants";
import { computeFinancial, type FinancialResult } from "./financial";
import { computeLayout, computeSite, type LayoutResult, type SiteResult } from "./site";
import {
  computeBattery,
  computeController,
  computeInverter,
  computeLoad,
  computePvRequirement,
  computeStrings,
  type BatteryResult,
  type ControllerResult,
  type InverterResult,
  type LoadResult,
  type PvInputDevice,
  type PvRequirement,
  type StringResult,
} from "./sizing";
import type { Check } from "./types";

export interface DesignResults {
  load: LoadResult;
  inverter: InverterResult;
  battery: BatteryResult;
  pv: PvRequirement & { arrayW: number; dailyYieldKWh: number; annualYieldKWh: number; solarFraction: number };
  strings: StringResult;
  controller: ControllerResult;
  cables: CableResult;
  layout: LayoutResult;
  site: SiteResult;
  boq: BoqResult;
  financial: FinancialResult;
  checks: Check[];
}

/** Runs the full sequential design. Pure: identical on the server and in the browser. */
export function computeDesign(d: DesignInputs): DesignResults {
  const load = computeLoad(d.loads, d.inverter.demandFactor);
  const pvReq = computePvRequirement(load.dailyWh, d.site.peakSunHours, d.pv, d.assessment.shadingLossPct);
  const inverter = computeInverter(load, d.inverter, pvReq.requiredPvW);
  const V = inverter.systemVoltage;

  const device: PvInputDevice =
    d.inverter.type === "hybrid"
      ? {
          label: "inverter",
          maxDcVoltage: inverter.spec.maxPvVoltage,
          mpptMinV: inverter.spec.mpptMinV,
          mpptMaxV: inverter.spec.mpptMaxV || inverter.spec.maxPvVoltage,
          maxInputCurrentA: inverter.spec.maxPvInputCurrentA,
          maxIscA: inverter.spec.maxPvIscA,
          mpptCount: inverter.spec.mpptCount,
          maxPvPowerW: inverter.spec.maxPvPowerW,
        }
      : {
          label: "charge controller",
          maxDcVoltage: d.controller.maxPvVoltage,
          // MPPT controllers need the PV voltage to stay comfortably above the battery charging voltage.
          mpptMinV: V * 1.2 + 5,
          mpptMaxV: d.controller.maxPvVoltage,
          maxInputCurrentA: 0,
          maxIscA: 0,
          mpptCount: 1,
          maxPvPowerW: 0,
        };

  const strings = computeStrings(d.pv.panel, device, d.site.tMin, d.site.tMax, pvReq.panelsRequired, d.strings, inverter.ratedPowerW);
  const controller = computeController(d.inverter, d.controller, strings.arrayW, V, inverter.spec.maxChargeCurrentA);

  const pvChargeA = strings.arrayW / V;
  const chargeCurrentA = d.inverter.type === "hybrid" && inverter.spec.maxChargeCurrentA > 0 ? Math.min(pvChargeA, inverter.spec.maxChargeCurrentA) : pvChargeA;
  const battery = computeBattery(load.dailyWh, V, inverter.ratedPowerW, d.inverter.efficiency, d.battery, chargeCurrentA);

  const dailyYieldKWh = (strings.arrayW * d.site.peakSunHours * d.pv.systemEfficiency * pvReq.shadingFactor) / 1000;
  const pv = {
    ...pvReq,
    arrayW: strings.arrayW,
    dailyYieldKWh,
    annualYieldKWh: dailyYieldKWh * 365,
    solarFraction: load.dailyWh > 0 ? Math.min(1, (dailyYieldKWh * 1000) / load.dailyWh) : 0,
  };

  const cables = computeCables({
    cables: d.cables,
    panel: d.pv.panel,
    strings,
    controller,
    systemVoltage: V,
    inverterRatedW: inverter.ratedPowerW,
    inverterEff: d.inverter.efficiency,
    gridAvailable: d.site.gridAvailable,
  });

  const layout = computeLayout(d.assessment, d.layout, d.pv.panel, strings.totalPanels, strings.series);
  const site = computeSite(d.site, d.assessment, layout, d.pv.panel, strings.totalPanels, cables.acBreakerA);

  const boq = computeBoq({
    boq: d.boq,
    site: d.site,
    panel: d.pv.panel,
    inverterSettings: d.inverter,
    inverter,
    batterySettings: d.battery,
    battery,
    strings,
    controller,
    cables,
    cableSettings: d.cables,
    layout,
  });

  const financial = computeFinancial({
    fin: d.financial,
    capex: boq.grandTotal,
    batteryCost: boq.batteryCost,
    inverterCost: boq.inverterCost,
    dailyYieldKWh,
    dailyDemandKWh: load.dailyWh / 1000,
    defaultBatteryLife: CHEMISTRY_INFO[d.battery.chemistry].lifeYears,
  });

  const pvChecks: Check[] = [
    {
      id: "pv-yield",
      step: "pv",
      label: "Daily yield covers daily demand",
      status: dailyYieldKWh * 1000 >= load.dailyWh - 1e-6 ? "pass" : "warn",
      detail: `${dailyYieldKWh.toFixed(2)} kWh/day expected vs ${(load.dailyWh / 1000).toFixed(2)} kWh/day demand`,
    },
  ];

  // Cross-check our yield model against Solargis' full PV simulation for the same month (or year).
  const cd = d.site.climateDetail;
  if (cd.gsaPvoutPerDay.length === 12 && strings.arrayW > 0) {
    const monthIdx = d.site.monthlyPsh.length === 12 ? d.site.monthlyPsh.findIndex((v) => Math.abs(v - d.site.peakSunHours) < 0.005) : -1;
    const ref = monthIdx >= 0 ? cd.gsaPvoutPerDay[monthIdx] : cd.gsaAnnualPvout / 365;
    const ours = d.site.peakSunHours * d.pv.systemEfficiency * pvReq.shadingFactor;
    const diffPct = ref > 0 ? ((ours - ref) / ref) * 100 : 0;
    pvChecks.push({
      id: "pv-solargis",
      step: "pv",
      label: "Yield consistent with Solargis simulation",
      // Being more optimistic than Solargis by >10 % risks an undersized array; being more conservative is fine.
      status: diffPct <= 10 ? "pass" : "warn",
      detail: `${ours.toFixed(2)} kWh/kWp/day designed vs ${ref.toFixed(2)} Solargis (${monthIdx >= 0 ? MONTH_NAMES[monthIdx] : "annual average"}, ${diffPct >= 0 ? "+" : ""}${diffPct.toFixed(0)} %)`,
    });
  }

  const checks = [
    ...site.checks.filter((c) => c.step === "site"),
    ...load.checks,
    ...inverter.checks,
    ...battery.checks,
    ...pvChecks,
    ...strings.checks,
    ...controller.checks,
    ...cables.checks,
    ...site.checks.filter((c) => c.step !== "site"),
    ...financial.checks,
  ];

  return { load, inverter, battery, pv, strings, controller, cables, layout, site, boq, financial, checks };
}

export function checksForStep(results: DesignResults, step: StepKey) {
  return results.checks.filter((c) => c.step === step);
}

export type { Check } from "./types";
