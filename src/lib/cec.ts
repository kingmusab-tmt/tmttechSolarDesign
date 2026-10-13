/** Shared types and pure helpers for the CEC module database (safe for client and server). */

/** Typical mass per m² of glass–backsheet crystalline modules; double-glass modules are heavier (~12.5). */
export const MODULE_KG_PER_M2 = 11.5;

export interface CecModule {
  id: number;
  manufacturer: string;
  model: string;
  technology: string;
  bifacial: boolean;
  dimsEstimated: boolean;
  weightEstimated: boolean;
  specs: {
    pmaxW: number;
    vocV: number;
    vmpV: number;
    iscA: number;
    impA: number;
    betaVocPct: number;
    gammaPmaxPct: number;
    noctC: number;
    lengthM: number;
    widthM: number;
    weightKg: number;
  };
}

export type CecRow = [string, string, string, number, number, number, number, number, number, number, number, number, number, number, number];

export function rowToModule(row: CecRow, id: number): CecModule {
  const [manufacturer, model, technology, bifacial, pmaxW, vocV, vmpV, iscA, impA, betaVocPct, gammaPmaxPct, noctC, lengthM, widthM, dimsEstimated] = row;
  return {
    id,
    manufacturer,
    model,
    technology,
    bifacial: bifacial === 1,
    dimsEstimated: dimsEstimated === 1,
    weightEstimated: true, // the CEC list does not publish module mass
    specs: { pmaxW, vocV, vmpV, iscA, impA, betaVocPct, gammaPmaxPct, noctC, lengthM, widthM, weightKg: Math.round(lengthM * widthM * MODULE_KG_PER_M2 * 10) / 10 },
  };
}

/** Every query token must appear in "manufacturer model technology"; numbers also match the wattage. */
export function searchModules(rows: CecRow[], query: string, opts: { minW?: number; maxW?: number; limit?: number } = {}) {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  const limit = Math.min(Math.max(opts.limit ?? 30, 1), 100);
  const hits: CecModule[] = [];
  let total = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const p = r[4];
    if (opts.minW && p < opts.minW) continue;
    if (opts.maxW && p > opts.maxW) continue;
    const hay = `${r[0]} ${r[1]} ${r[2]}`.toLowerCase();
    if (!tokens.every((t) => hay.includes(t) || (/^\d+$/.test(t) && Number(t) === p))) continue;
    total++;
    if (hits.length < limit) hits.push(rowToModule(r, i));
  }
  return { total, items: hits };
}
