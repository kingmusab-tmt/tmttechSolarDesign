import type { FinancialSettings } from "../schemas";
import { check, type Check } from "./types";

export interface CashFlowYear {
  year: number;
  savings: number;
  om: number;
  replacements: number;
  net: number;
  cumulative: number;
  energyKWh: number;
}

export interface FinancialResult {
  capex: number;
  annualBaselineCost: number;
  year1Savings: number;
  paybackYears: number | null;
  npv: number;
  irr: number | null;
  lcoe: number;
  baselineCostPerKWh: number;
  lifetimeSavings: number;
  roiPct: number;
  co2AvoidedTonnesPerYear: number;
  batteryLifeYears: number;
  flows: CashFlowYear[];
  checks: Check[];
}

/** Internal rate of return by bisection on NPV(r) = 0. */
export function irr(cashflows: number[]): number | null {
  const npvAt = (r: number) => cashflows.reduce((a, c, t) => a + c / (1 + r) ** t, 0);
  let lo = -0.99;
  let hi = 10;
  let fLo = npvAt(lo);
  const fHi = npvAt(hi);
  if (fLo * fHi > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const f = npvAt(mid);
    if (Math.abs(f) < 1e-6) return mid;
    if (f * fLo < 0) hi = mid;
    else {
      lo = mid;
      fLo = f;
    }
  }
  return (lo + hi) / 2;
}

interface FinancialInputs {
  fin: FinancialSettings;
  capex: number;
  batteryCost: number;
  inverterCost: number;
  dailyYieldKWh: number;
  dailyDemandKWh: number;
  defaultBatteryLife: number;
}

export function computeFinancial(x: FinancialInputs): FinancialResult {
  const { fin, capex, batteryCost, inverterCost } = x;
  const esc = fin.escalationPct / 100;
  const r = fin.discountRatePct / 100;
  const deg = fin.degradationPct / 100;
  const annualBaselineCost = (fin.monthlyGridCost + fin.monthlyGeneratorCost) * 12;
  const year1Savings = annualBaselineCost * (fin.displacementPct / 100);
  const batteryLifeYears = fin.batteryLifeYears > 0 ? fin.batteryLifeYears : x.defaultBatteryLife;

  const flows: CashFlowYear[] = [];
  let cumulative = -capex;
  let paybackYears: number | null = null;
  let pvCosts = capex;
  let pvEnergy = 0;
  const cash: number[] = [-capex];
  for (let y = 1; y <= fin.lifetimeYears; y++) {
    const priceIdx = (1 + esc) ** (y - 1);
    const degIdx = (1 - deg) ** (y - 1);
    // Savings track the energy the system still delivers, priced at the escalated tariff.
    const savings = year1Savings * priceIdx * degIdx;
    const om = capex * (fin.omPctOfCapex / 100) * priceIdx;
    let replacements = 0;
    if (batteryLifeYears > 0 && y % batteryLifeYears === 0 && y < fin.lifetimeYears) replacements += batteryCost * priceIdx;
    if (fin.inverterLifeYears > 0 && y % fin.inverterLifeYears === 0 && y < fin.lifetimeYears) replacements += inverterCost * priceIdx;
    const net = savings - om - replacements;
    const prev = cumulative;
    cumulative += net;
    if (paybackYears === null && cumulative >= 0 && net > 0) paybackYears = y - 1 + -prev / net;
    const energyKWh = Math.min(x.dailyYieldKWh * degIdx, x.dailyDemandKWh) * 365;
    pvCosts += (om + replacements) / (1 + r) ** y;
    pvEnergy += energyKWh / (1 + r) ** y;
    cash.push(net);
    flows.push({ year: y, savings, om, replacements, net, cumulative, energyKWh });
  }

  const npv = cash.reduce((a, c, t) => a + c / (1 + r) ** t, 0);
  const lifetimeSavings = flows.reduce((a, f) => a + f.net, 0);
  const year1Energy = flows[0]?.energyKWh ?? 0;
  const checks: Check[] = [
    check("financial", "fin-payback", "Payback within system life", paybackYears !== null, paybackYears !== null ? `Simple payback ≈ ${paybackYears.toFixed(1)} years` : "The system does not pay back within its lifetime at these assumptions", "warn"),
    check("financial", "fin-npv", "Positive NPV", npv > 0, `NPV at ${fin.discountRatePct} %: ${Math.round(npv).toLocaleString()}`, "warn"),
  ];

  return {
    capex,
    annualBaselineCost,
    year1Savings,
    paybackYears,
    npv,
    irr: capex > 0 ? irr(cash) : null,
    lcoe: pvEnergy > 0 ? pvCosts / pvEnergy : 0,
    baselineCostPerKWh: year1Energy > 0 ? annualBaselineCost / (x.dailyDemandKWh * 365) : 0,
    lifetimeSavings,
    roiPct: capex > 0 ? (lifetimeSavings / capex) * 100 : 0,
    // Small petrol/diesel generator ≈ 0.8 kg CO2 per kWh delivered.
    co2AvoidedTonnesPerYear: (year1Energy * 0.8) / 1000,
    batteryLifeYears,
    flows,
    checks,
  };
}
