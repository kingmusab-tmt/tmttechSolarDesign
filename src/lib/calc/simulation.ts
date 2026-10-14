import type { LoadItem } from "../schemas";
import { round } from "./constants";
import { check, type Check } from "./types";

/*
 * Year-round energy balance, hour by hour (8760 h):
 *  - PV: each month's design yield, shaped as a half-sine from 06:00 to 18:00, with day-to-day weather
 *    variation (fixed pseudo-random sequence, so results are repeatable) that keeps each month's mean.
 *  - Load: lighting in the evening from 18:00; other appliances spread over a typical household profile.
 *  - Battery: charges from surplus PV and discharges to the load between full and its depth-of-discharge
 *    floor, with round-trip losses. Anything the battery cannot cover comes from the grid / generator
 *    (or goes unserved without one); PV that cannot be stored is reported as surplus.
 */

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Typical household use outside lighting, by hour (relative). */
const HOUSE_PROFILE = [0.5, 0.45, 0.45, 0.45, 0.5, 0.7, 1.0, 1.1, 0.9, 0.8, 0.8, 0.85, 0.9, 0.9, 0.85, 0.85, 0.9, 1.0, 1.3, 1.45, 1.45, 1.3, 1.0, 0.7];

export interface MonthSim {
  month: string;
  pvKWh: number;
  loadKWh: number;
  backupKWh: number; // from grid / generator, or unserved without one
  surplusKWh: number;
  minSocPct: number;
  shortDays: number;
}

export interface SimulationResult {
  months: MonthSim[];
  annual: { pvKWh: number; loadKWh: number; backupKWh: number; surplusKWh: number; solarFractionPct: number; shortDays: number; lossOfLoadHoursPct: number; cycles: number; minSocPct: number };
  dailyMinSocPct: number[]; // 365 values
  backupSource: "grid/generator" | "unserved";
  checks: Check[];
}

/** Small deterministic PRNG (mulberry32) so the synthetic weather is identical on every run. */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hourly load shape (kWh per hour, summing to the daily energy). */
export function hourlyLoad(loads: LoadItem[], dailyWh: number): number[] {
  const h = new Array(24).fill(0);
  const house = HOUSE_PROFILE.reduce((a, b) => a + b, 0);
  for (const l of loads) {
    const wh = l.watts * l.qty * l.hoursPerDay;
    if (wh <= 0) continue;
    if (/light/i.test(l.category)) {
      // lights on from 18:00 for their hours of use (wrapping past midnight)
      const hours = Math.min(24, l.hoursPerDay);
      for (let k = 0; k < Math.ceil(hours); k++) h[(18 + k) % 24] += (l.watts * l.qty * Math.min(1, hours - k)) / 1000;
    } else if (l.hoursPerDay >= 20) {
      for (let k = 0; k < 24; k++) h[k] += wh / 24 / 1000;
    } else {
      for (let k = 0; k < 24; k++) h[k] += (wh * HOUSE_PROFILE[k]) / house / 1000;
    }
  }
  const total = h.reduce((a, b) => a + b, 0);
  const target = dailyWh / 1000;
  return total > 0 ? h.map((v) => (v * target) / total) : h;
}

export function simulateYear(x: {
  loads: LoadItem[];
  dailyWh: number;
  dailyYieldKWhPerPsh: number; // design yield per peak-sun-hour (array, losses and shading included)
  monthlyPsh: number[]; // 12 values
  usableKWh: number;
  roundTrip: number;
  backupAvailable: boolean;
}): SimulationResult {
  const load24 = hourlyLoad(x.loads, x.dailyWh);
  const pvShape = Array.from({ length: 24 }, (_, k) => (k >= 6 && k < 18 ? Math.sin(((k + 0.5 - 6) / 12) * Math.PI) : 0));
  const shapeSum = pvShape.reduce((a, b) => a + b, 0);
  const effIn = Math.sqrt(x.roundTrip);
  const effOut = Math.sqrt(x.roundTrip);
  const cap = Math.max(0, x.usableKWh);

  // Day-to-day weather factors, normalised to a mean of 1 within each month.
  const rnd = prng(20251014);
  const weather = DAYS_IN_MONTH.map((n) => {
    const f = Array.from({ length: n }, () => {
      const g = (rnd() + rnd() + rnd() - 1.5) * 2; // ≈ normal, sd ≈ 1
      return Math.min(1.45, Math.max(0.15, 1 + 0.3 * g));
    });
    const mean = f.reduce((a, b) => a + b, 0) / n;
    return f.map((v) => v / mean);
  });

  let soc = cap; // start full on 1 January; run the year twice and report the second
  let result: SimulationResult | null = null;
  for (let pass = 0; pass < 2; pass++) {
    const months: MonthSim[] = [];
    const dailyMin: number[] = [];
    let throughput = 0;
    let shortHours = 0;
    for (let m = 0; m < 12; m++) {
      const psh = x.monthlyPsh[m];
      const ms: MonthSim = { month: MONTHS[m], pvKWh: 0, loadKWh: 0, backupKWh: 0, surplusKWh: 0, minSocPct: 100, shortDays: 0 };
      for (let d = 0; d < DAYS_IN_MONTH[m]; d++) {
        const dayPv = x.dailyYieldKWhPerPsh * psh * weather[m][d];
        let dayMin = cap > 0 ? soc / cap : 0;
        let short = false;
        for (let k = 0; k < 24; k++) {
          const pv = (dayPv * pvShape[k]) / shapeSum;
          const load = load24[k];
          ms.pvKWh += pv;
          ms.loadKWh += load;
          const net = pv - load;
          if (net >= 0) {
            const store = Math.min(net * effIn, cap - soc);
            soc += store;
            ms.surplusKWh += net - store / effIn;
          } else {
            const need = -net / effOut;
            const draw = Math.min(need, soc);
            soc -= draw;
            throughput += draw;
            const unmet = (need - draw) * effOut;
            if (unmet > 1e-6) {
              ms.backupKWh += unmet;
              short = true;
              shortHours++;
            }
          }
          if (cap > 0) dayMin = Math.min(dayMin, soc / cap);
        }
        if (short) ms.shortDays++;
        ms.minSocPct = Math.min(ms.minSocPct, dayMin * 100);
        dailyMin.push(dayMin * 100);
      }
      months.push(ms);
    }
    const sum = (k: keyof Omit<MonthSim, "month" | "minSocPct">) => months.reduce((a, mo) => a + mo[k], 0);
    const loadKWh = sum("loadKWh");
    const backupKWh = sum("backupKWh");
    result = {
      months,
      annual: {
        pvKWh: sum("pvKWh"),
        loadKWh,
        backupKWh,
        surplusKWh: sum("surplusKWh"),
        solarFractionPct: loadKWh > 0 ? ((loadKWh - backupKWh) / loadKWh) * 100 : 100,
        shortDays: sum("shortDays"),
        lossOfLoadHoursPct: (shortHours / 8760) * 100,
        cycles: cap > 0 ? throughput / cap : 0,
        minSocPct: Math.min(...months.map((mo) => mo.minSocPct)),
      },
      dailyMinSocPct: dailyMin,
      backupSource: x.backupAvailable ? "grid/generator" : "unserved",
      checks: [],
    };
  }
  const r = result!;
  const a = r.annual;
  const worst = [...r.months].sort((p, q) => q.backupKWh - p.backupKWh)[0];
  r.checks.push(
    check(
      "battery",
      "sim-year",
      "Covers the load all year (hourly simulation)",
      a.shortDays === 0,
      a.shortDays === 0
        ? `No shortfall in a simulated year; lowest charge ${round(a.minSocPct, 0)} % of usable capacity, ${round(a.cycles, 0)} cycles/year`
        : `${a.shortDays} day(s) short, ${round(a.backupKWh, 0)} kWh/year ${x.backupAvailable ? "from the grid / generator" : "unserved"} (${round(100 - a.solarFractionPct, 1)} % of demand), worst in ${worst.month}. ${x.backupAvailable ? "" : "Add PV or battery capacity, or a generator."}`,
      // Occasional dull days covered by an available grid/generator are expected, not a defect.
      x.backupAvailable ? (a.solarFractionPct >= 95 ? "info" : "warn") : a.solarFractionPct >= 97 ? "warn" : "fail",
    ),
  );
  return r;
}
