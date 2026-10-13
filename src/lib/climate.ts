export const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"] as const;
export const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS_IN_MONTH = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Months where the two sources differ by more than this are flagged for the engineer. */
export const DISAGREEMENT_PCT = 15;

const r2 = (v: number) => Math.round(v * 100) / 100;
const valid = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > -900;
const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;

/* ------------------------------------------------------------------ */
/* NASA POWER: horizontal irradiance + temperature extremes            */
/* ------------------------------------------------------------------ */

export interface NasaClimate {
  monthlyPsh: number[]; // kWh/m²/day on a horizontal plane = peak sun hours
  annualPsh: number;
  tMin: number; // lowest monthly minimum over the period, rounded down
  tMax: number; // highest monthly maximum, rounded up
}

export function nasaPowerUrl(lat: number, lon: number) {
  const q = new URLSearchParams({ parameters: "ALLSKY_SFC_SW_DWN,T2M_MIN,T2M_MAX", community: "RE", latitude: lat.toFixed(4), longitude: lon.toFixed(4), format: "JSON" });
  return `https://power.larc.nasa.gov/api/temporal/climatology/point?${q}`;
}

type Series = Record<string, number>;

/** Parse a NASA POWER climatology response. Throws if values are missing or fill values (-999). */
export function parseNasaPower(json: unknown): NasaClimate {
  const props = (json as { properties?: { parameter?: Record<string, Series> } })?.properties?.parameter;
  const ghi = props?.ALLSKY_SFC_SW_DWN;
  const tmin = props?.T2M_MIN;
  const tmax = props?.T2M_MAX;
  if (!ghi || !tmin || !tmax) throw new Error("Unexpected NASA POWER response");
  const monthlyPsh = MONTHS.map((m) => ghi[m]);
  if (!monthlyPsh.every(valid)) throw new Error("No irradiance data for this location");
  const mins = MONTHS.map((m) => tmin[m]).filter(valid);
  const maxs = MONTHS.map((m) => tmax[m]).filter(valid);
  if (!mins.length || !maxs.length) throw new Error("No temperature data for this location");
  return {
    monthlyPsh: monthlyPsh.map(r2),
    annualPsh: r2(valid(ghi.ANN) ? ghi.ANN : mean(monthlyPsh)),
    // Round outward so the design temperatures are never less severe than the data.
    tMin: Math.floor(Math.min(...mins)),
    tMax: Math.ceil(Math.max(...maxs)),
  };
}

/* ------------------------------------------------------------------ */
/* Global Solar Atlas: values pasted by the engineer                   */
/* ------------------------------------------------------------------ */
/*
 * The Global Solar Atlas terms of use forbid automated access, so the app never contacts it.
 * The engineer reads the site themselves and pastes the 12 monthly values here.
 */

export function gsaSiteUrl(lat: number, lon: number) {
  return `https://globalsolaratlas.info/map?s=${lat.toFixed(6)},${lon.toFixed(6)}&m=site`;
}

export interface PastedSeries {
  /** Per-day values Jan..Dec. */
  perDay: number[];
  /** True when the input looked like monthly totals and was divided by the days in each month. */
  convertedFromTotals: boolean;
}

/**
 * Parse 12 monthly values pasted from the atlas (spaces, tabs, commas or new lines).
 * Accepts either per-day values (e.g. 4.76) or monthly totals (e.g. 147.6 kWh/m²); a 13th
 * value (the annual figure) is ignored. Decimal commas are not supported, to avoid ambiguity.
 */
export function parsePastedMonthly(text: string, maxPerDay = 12): PastedSeries {
  const nums = (text.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  if (nums.length < 12) throw new Error(`Found ${nums.length} numbers; paste all 12 monthly values (Jan–Dec)`);
  if (nums.length > 13) throw new Error(`Found ${nums.length} numbers; paste only the 12 monthly values (an annual total at the end is fine)`);
  const months = nums.slice(0, 12);
  if (months.some((v) => !(v > 0))) throw new Error("All monthly values must be positive numbers");
  // Monthly totals are roughly 30× the daily figure: anything above the plausible daily maximum is a total.
  const convertedFromTotals = mean(months) > maxPerDay;
  const perDay = convertedFromTotals ? months.map((v, i) => r2(v / DAYS_IN_MONTH[i])) : months.map(r2);
  if (perDay.some((v) => v > maxPerDay)) throw new Error("Values are out of range: expected kWh/m²/day (≈ 2–8) or monthly totals (≈ 60–250)");
  return { perDay, convertedFromTotals };
}

/* ------------------------------------------------------------------ */
/* Combination                                                         */
/* ------------------------------------------------------------------ */

export type ClimateMethod = "none" | "average" | "gsa" | "nasa";

export interface CombinedClimate {
  /** The profile used for design: the monthly average of both sources, or whichever is available. */
  monthlyPsh: number[];
  annualPsh: number;
  worstMonth: { index: number; value: number };
  method: Exclude<ClimateMethod, "none">;
  source: string;
  /** Month indexes where the sources differ by more than DISAGREEMENT_PCT. */
  disagreeMonths: number[];
  maxDiffPct: number;
}

export function combineClimate(gsaPsh: number[] | null, nasaPsh: number[] | null): CombinedClimate {
  const g = gsaPsh?.length === 12 ? gsaPsh : null;
  const n = nasaPsh?.length === 12 ? nasaPsh : null;
  if (!g && !n) throw new Error("No climate data available");

  let monthlyPsh: number[];
  let method: CombinedClimate["method"];
  const disagreeMonths: number[] = [];
  let maxDiffPct = 0;
  if (g && n) {
    method = "average";
    monthlyPsh = g.map((v, i) => r2((v + n[i]) / 2));
    g.forEach((v, i) => {
      const diff = (Math.abs(v - n[i]) / ((v + n[i]) / 2)) * 100;
      maxDiffPct = Math.max(maxDiffPct, diff);
      if (diff > DISAGREEMENT_PCT) disagreeMonths.push(i);
    });
  } else if (g) {
    method = "gsa";
    monthlyPsh = g;
  } else {
    method = "nasa";
    monthlyPsh = n!;
  }

  let worst = 0;
  monthlyPsh.forEach((v, i) => {
    if (v < monthlyPsh[worst]) worst = i;
  });
  const source = method === "average" ? "Average of Global Solar Atlas (entered) and NASA POWER" : method === "gsa" ? "Global Solar Atlas (entered)" : "NASA POWER";
  return { monthlyPsh, annualPsh: r2(mean(monthlyPsh)), worstMonth: { index: worst, value: monthlyPsh[worst] }, method, source, disagreeMonths, maxDiffPct: r2(maxDiffPct) };
}
