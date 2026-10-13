/**
 * Built-in equipment library.
 *
 * VERIFIED items: values transcribed from the manufacturer's official datasheet (linked in
 * datasheetUrl), checked page by page. GENERIC items: typical values for product classes not yet
 * covered by a verified model (e.g. 12 V systems, lead-acid batteries) and are labelled as such.
 *
 * Bump SEED_VERSION whenever this list changes; existing databases are upserted by seedKey.
 */
export const SEED_VERSION = 3;

export interface SeedItem {
  seedKey: string;
  type: "panel" | "inverter" | "battery" | "controller";
  brand: string;
  model: string;
  verified: boolean;
  datasheetUrl: string;
  notes: string;
  specs: Record<string, number | string>;
}

const DEYE_SG04LP1 = "https://deye.com/wp-content/uploads/2026/07/%E3%80%90b%E3%80%91datasheet_sun-3-6k-sg04lp1_20260706_en.pdf";
const GROWATT_SPF_ES = "https://www.solarproof.com.au/datasheets/inverter_datasheet_Shenzhen_Growatt_New_Energy_Technology_Co_Ltd_SPF_3500_ES_20260409032819.pdf";
const VICTRON_MP2 = "https://www.victronenergy.com/upload/documents/Datasheet-MultiPlus-II-inverter-charger-EN.pdf";
const VICTRON_150 = "https://www.victronenergy.com/upload/documents/Datasheet-SmartSolar-charge-controller-MPPT-150-45-up-to-150-100-EN.pdf";
const VICTRON_250 = "https://www.victronenergy.com/upload/documents/Datasheet-SmartSolar-charge-controller-MPPT-250-60-up-to-250-100-EN.pdf";
const PYLONTECH_US5000 = "https://fvcomponentes.com/wp-content/uploads/2024/01/Pylontech-US5000-48KWh-48V.pdf";
const DEYE_SE_G51 = "https://deye.com/wp-content/uploads/2026/09/deye-se-g5.1-pro-b-series_brochure_20260907v1.0.pdf";

/** Expand one datasheet's power-class table into individual verified modules. */
function panelSeries(x: {
  brand: string;
  prefix: string;
  datasheetUrl: string;
  notes: string;
  common: { betaVocPct: number; gammaPmaxPct: number; noctC: number; lengthM: number; widthM: number; weightKg: number };
  rows: [model: string, pmaxW: number, vocV: number, vmpV: number, iscA: number, impA: number][];
}): SeedItem[] {
  return x.rows.map(([model, pmaxW, vocV, vmpV, iscA, impA]) => ({
    seedKey: `${x.prefix}-${model.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    type: "panel",
    brand: x.brand,
    model,
    verified: true,
    datasheetUrl: x.datasheetUrl,
    notes: x.notes,
    specs: { pmaxW, vocV, vmpV, iscA, impA, ...x.common },
  }));
}

const generic = (seedKey: string, type: SeedItem["type"], model: string, specs: SeedItem["specs"]): SeedItem => ({
  seedKey,
  type,
  brand: "Generic",
  model,
  verified: false,
  datasheetUrl: "",
  notes: "Typical values for this product class, not a specific product. Replace with the real model's datasheet.",
  specs,
});

export const EQUIPMENT_SEED: SeedItem[] = [
  /* ---------------- Verified PV modules ---------------- */
  // [model, Pmax W, Voc V, Vmp V, Isc A, Imp A] per series, straight from each datasheet's STC table.
  ...panelSeries({
    brand: "Jinko Solar",
    prefix: "jinko",
    datasheetUrl: "https://www.jinkosolar.com/uploads/JKM555-575N-72HL4-(V)-F1-EN.pdf",
    notes: "Official Jinko datasheet JKM555-575N-72HL4-(V)-F1-EN. Tiger Neo N-type, 144 half-cells, mono-facial. Max system voltage 1000/1500 V.",
    common: { betaVocPct: -0.25, gammaPmaxPct: -0.3, noctC: 45, lengthM: 2.278, widthM: 1.134, weightKg: 28 },
    rows: [
      ["JKM555N-72HL4-V", 555, 50.34, 41.64, 14.07, 13.33],
      ["JKM560N-72HL4-V", 560, 50.47, 41.77, 14.15, 13.41],
      ["JKM565N-72HL4-V", 565, 50.6, 41.92, 14.23, 13.48],
      ["JKM570N-72HL4-V", 570, 50.74, 42.07, 14.31, 13.55],
      ["JKM575N-72HL4-V", 575, 50.88, 42.22, 14.39, 13.62],
    ],
  }),
  ...panelSeries({
    brand: "LONGi",
    prefix: "longi",
    datasheetUrl: "https://liriksolar.com/image/uploads/LONGI%20Solar%20Hi-MO%206%20Explorer%20LR5-72HTH-585M%20Datasheet.pdf",
    notes: "LONGi datasheet Hi-MO X6 Explorer LR5-72HTH 565~585M (20230926V19). 144 half-cells, single glass. Max system voltage 1500 V.",
    common: { betaVocPct: -0.23, gammaPmaxPct: -0.29, noctC: 45, lengthM: 2.278, widthM: 1.134, weightKg: 27.2 },
    rows: [
      ["LR5-72HTH-565M", 565, 51.76, 43.61, 14.01, 12.96],
      ["LR5-72HTH-570M", 570, 51.91, 43.76, 14.07, 13.03],
      ["LR5-72HTH-575M", 575, 52.06, 43.91, 14.14, 13.1],
      ["LR5-72HTH-580M", 580, 52.21, 44.06, 14.2, 13.17],
      ["LR5-72HTH-585M", 585, 52.36, 44.21, 14.27, 13.24],
    ],
  }),
  ...panelSeries({
    brand: "LONGi",
    prefix: "longi",
    datasheetUrl: "https://cdn.shopify.com/s/files/1/0882/5641/4023/files/Datasheet_Longi_LR5-72HTH_590_600M.pdf",
    notes: "LONGi datasheet Hi-MO 6 Scientist LR5-72HTH 590~600M (20230811V19). 144 half-cells, single glass. Max system voltage 1500 V.",
    common: { betaVocPct: -0.23, gammaPmaxPct: -0.29, noctC: 45, lengthM: 2.278, widthM: 1.134, weightKg: 27.2 },
    rows: [
      ["LR5-72HTH-590M", 590, 52.51, 44.36, 14.33, 13.31],
      ["LR5-72HTH-595M", 595, 52.66, 44.51, 14.4, 13.37],
      ["LR5-72HTH-600M", 600, 52.81, 44.66, 14.46, 13.44],
    ],
  }),
  ...panelSeries({
    brand: "JA Solar",
    prefix: "ja",
    datasheetUrl: "https://www.kvelektro.cz/api/products/2008101/images/O/jam54s30-datasheet-en.pdf",
    notes: "JA Solar datasheet JAM54S30 400-425/GR (Deep Blue 3.0 Pro). 108 half-cells, compact 1722 mm format. Max system voltage 1000/1500 V.",
    common: { betaVocPct: -0.275, gammaPmaxPct: -0.35, noctC: 45, lengthM: 1.722, widthM: 1.134, weightKg: 19.5 },
    rows: [
      ["JAM54S30-400/GR", 400, 37.07, 31.01, 13.79, 12.9],
      ["JAM54S30-405/GR", 405, 37.23, 31.21, 13.87, 12.98],
      ["JAM54S30-410/GR", 410, 37.32, 31.45, 13.95, 13.04],
      ["JAM54S30-415/GR", 415, 37.45, 31.61, 14.02, 13.13],
      ["JAM54S30-420/GR", 420, 37.58, 31.8, 14.1, 13.21],
      ["JAM54S30-425/GR", 425, 37.72, 31.98, 14.18, 13.29],
    ],
  }),
  ...panelSeries({
    brand: "Canadian Solar",
    prefix: "canadian",
    datasheetUrl: "https://www.vicoexport.com/wp-content/uploads/2024/04/CS-Datasheet-HiKu6_CS6R-MS-HL_v1.3_F23_EN_395-420W_Vico_Export_Solar_Energy.pdf",
    notes: "Canadian Solar datasheet HiKu6 CS6R-MS-HL V1.3 (Sept 2023). 108 half-cells, compact 1722 mm format. Temperature shown is NMOT 41 °C (same 800 W/m², 20 °C, 1 m/s conditions as NOCT).",
    common: { betaVocPct: -0.26, gammaPmaxPct: -0.34, noctC: 41, lengthM: 1.722, widthM: 1.134, weightKg: 22.4 },
    rows: [
      ["CS6R-395MS-HL", 395, 36.6, 30.6, 13.77, 12.91],
      ["CS6R-400MS-HL", 400, 36.8, 30.8, 13.85, 12.99],
      ["CS6R-405MS-HL", 405, 37.0, 31.0, 13.93, 13.07],
      ["CS6R-410MS-HL", 410, 37.2, 31.2, 14.01, 13.15],
      ["CS6R-415MS-HL", 415, 37.4, 31.4, 14.09, 13.23],
      ["CS6R-420MS-HL", 420, 37.6, 31.6, 14.17, 13.31],
    ],
  }),

  /* ---------------- Verified hybrid inverters (built-in MPPT) ---------------- */
  {
    seedKey: "deye-sun-5k-sg04lp1-eu",
    type: "inverter",
    brand: "Deye",
    model: "SUN-5K-SG04LP1-EU",
    verified: true,
    datasheetUrl: DEYE_SG04LP1,
    notes: "Official Deye datasheet (SUN-3/3.6/5/6K-SG04LP1-EU, 2026-07). Battery 40–60 V. Peak power 2× rated for 10 s. MPPT start-up 125 V.",
    specs: { kind: "hybrid", batteryVoltage: 48, ratedPowerW: 5000, surgePowerW: 10000, maxPvVoltage: 500, mpptMinV: 150, mpptMaxV: 425, maxPvPowerW: 8000, maxPvInputCurrentA: 18, maxPvIscA: 27, mpptCount: 2, maxChargeCurrentA: 120 },
  },
  {
    seedKey: "deye-sun-6k-sg04lp1-eu",
    type: "inverter",
    brand: "Deye",
    model: "SUN-6K-SG04LP1-EU",
    verified: true,
    datasheetUrl: DEYE_SG04LP1,
    notes: "Official Deye datasheet (SUN-3/3.6/5/6K-SG04LP1-EU, 2026-07). Battery 40–60 V. Peak power 2× rated for 10 s. MPPT start-up 125 V.",
    specs: { kind: "hybrid", batteryVoltage: 48, ratedPowerW: 6000, surgePowerW: 12000, maxPvVoltage: 500, mpptMinV: 150, mpptMaxV: 425, maxPvPowerW: 9600, maxPvInputCurrentA: 18, maxPvIscA: 27, mpptCount: 2, maxChargeCurrentA: 135 },
  },
  {
    seedKey: "growatt-spf-3500-es",
    type: "inverter",
    brand: "Growatt",
    model: "SPF 3500 ES",
    verified: true,
    datasheetUrl: GROWATT_SPF_ES,
    notes: "Growatt SPF 3500~5000 ES datasheet. Off-grid, 48 V battery. PV short-circuit current limit not stated (only 22 A max input current). Max AC charge current 60 A.",
    specs: { kind: "hybrid", batteryVoltage: 48, ratedPowerW: 3500, surgePowerW: 7000, maxPvVoltage: 450, mpptMinV: 120, mpptMaxV: 430, maxPvPowerW: 4500, maxPvInputCurrentA: 22, maxPvIscA: 0, mpptCount: 1, maxChargeCurrentA: 80 },
  },
  {
    seedKey: "growatt-spf-5000-es",
    type: "inverter",
    brand: "Growatt",
    model: "SPF 5000 ES",
    verified: true,
    datasheetUrl: GROWATT_SPF_ES,
    notes: "Growatt SPF 3500~5000 ES datasheet. Off-grid, 48 V battery. PV short-circuit current limit not stated (only 22 A max input current). Max AC charge current 80 A.",
    specs: { kind: "hybrid", batteryVoltage: 48, ratedPowerW: 5000, surgePowerW: 10000, maxPvVoltage: 450, mpptMinV: 120, mpptMaxV: 430, maxPvPowerW: 6000, maxPvInputCurrentA: 22, maxPvIscA: 0, mpptCount: 1, maxChargeCurrentA: 100 },
  },

  /* ------- Verified inverter/chargers (no MPPT: pair with a charge controller) ------- */
  ...(
    [
      ["24/3000/70-32", 24, 2400, 5500, "2200 W at 40 °C", 70],
      ["48/3000/35-32", 48, 2400, 5500, "2200 W at 40 °C", 35],
      ["24/5000/120-50", 24, 4000, 9000, "3700 W at 40 °C", 120],
      ["48/5000/70-50", 48, 4000, 9000, "3700 W at 40 °C", 70],
    ] as const
  ).map(
    ([m, v, rated, peak, derate, acCharge]): SeedItem => ({
      seedKey: `victron-multiplus-ii-${m.replace(/\//g, "-").toLowerCase()}`,
      type: "inverter",
      brand: "Victron Energy",
      model: `MultiPlus-II ${m} 230V`,
      verified: true,
      datasheetUrl: VICTRON_MP2,
      notes: `Official Victron datasheet. Continuous ${rated} W at 25 °C (${derate}). No built-in MPPT: design as standalone inverter + charge controller. AC charger ${acCharge} A.`,
      specs: { kind: "inverter_charger", batteryVoltage: v, ratedPowerW: rated, surgePowerW: peak, maxPvVoltage: 0, mpptMinV: 0, mpptMaxV: 0, maxPvPowerW: 0, maxPvInputCurrentA: 0, maxPvIscA: 0, mpptCount: 1, maxChargeCurrentA: 0 },
    }),
  ),

  /* ---------------- Verified batteries ---------------- */
  {
    seedKey: "pylontech-us5000",
    type: "battery",
    brand: "Pylontech",
    model: "US5000 (48 V 4.8 kWh)",
    verified: true,
    datasheetUrl: PYLONTECH_US5000,
    notes: "Pylontech datasheet PY21US05-1. 4800 Wh nominal / 4560 Wh usable (95 % DoD). Recommended 50 A, max 100 A charge/discharge. 40 kg. Up to 16 in one group.",
    specs: { chemistry: "lifepo4", unitVoltage: 48, unitAh: 100, dod: 0.95, maxChargeCRate: 0.5, maxDischargeCRate: 1 },
  },
  {
    seedKey: "deye-se-g5-1-pro-b",
    type: "battery",
    brand: "Deye",
    model: "SE-G5.1 Pro-B (51.2 V 100 Ah)",
    verified: true,
    datasheetUrl: DEYE_SE_G51,
    notes: "Official Deye brochure (2026-09). 5.12 kWh. Recommended DoD 90 %. Recommended 50 A, max 100 A, peak 150 A (2 min). Built-in 125 A breaker. 45 kg.",
    specs: { chemistry: "lifepo4", unitVoltage: 51.2, unitAh: 100, dod: 0.9, maxChargeCRate: 0.5, maxDischargeCRate: 1 },
  },

  /* ---------------- Verified charge controllers ---------------- */
  ...(
    [
      ["150/60", 60, 150, "50 A", "860/1720/3440 W"],
      ["150/70", 70, 150, "50 A", "1000/2000/4000 W"],
      ["250/60", 60, 250, "35 A", "860/1720/3440 W"],
      ["250/70", 70, 250, "35 A", "1000/2000/4000 W"],
    ] as const
  ).map(
    ([m, amps, voc, isc, pv]): SeedItem => ({
      seedKey: `victron-smartsolar-${m.replace("/", "-")}`,
      type: "controller",
      brand: "Victron Energy",
      model: `SmartSolar MPPT ${m}`,
      verified: true,
      datasheetUrl: m.startsWith("150") ? VICTRON_150 : VICTRON_250,
      notes: `Official Victron datasheet. Max PV Voc ${voc} V (absolute, coldest conditions; ${voc - 5} V operating). Max PV short-circuit current ${isc}. Nominal PV power at 12/24/48 V: ${pv}; excess is clipped. PV must exceed Vbat + 5 V to start.`,
      specs: { ratedCurrentA: amps, maxPvVoltage: voc, maxPvPowerW: 0 },
    }),
  ),

  /* ---------------- Generic placeholders (gaps not yet covered above) ---------------- */
  generic("generic-panel-200-12v", "panel", "Mono 200W (36-cell, 12 V class)", { pmaxW: 200, vocV: 24.3, vmpV: 20.1, iscA: 10.5, impA: 9.95, betaVocPct: -0.3, gammaPmaxPct: -0.38, noctC: 45, lengthM: 1.48, widthM: 0.68, weightKg: 11.5 }),
  generic("generic-inv-1500-12v", "inverter", "Hybrid 1.5 kW / 12 V", { kind: "hybrid", batteryVoltage: 12, ratedPowerW: 1500, surgePowerW: 3000, maxPvVoltage: 145, mpptMinV: 30, mpptMaxV: 130, maxPvPowerW: 1500, maxPvInputCurrentA: 40, maxPvIscA: 50, mpptCount: 1, maxChargeCurrentA: 80 }),
  generic("generic-inv-3500-24v", "inverter", "Hybrid 3.5 kW / 24 V", { kind: "hybrid", batteryVoltage: 24, ratedPowerW: 3500, surgePowerW: 7000, maxPvVoltage: 500, mpptMinV: 120, mpptMaxV: 450, maxPvPowerW: 5000, maxPvInputCurrentA: 18, maxPvIscA: 22, mpptCount: 1, maxChargeCurrentA: 120 }),
  generic("generic-bat-tubular-200", "battery", "Tubular flooded 12 V 200 Ah", { chemistry: "lead_acid", dod: 0.5, unitVoltage: 12, unitAh: 200, maxChargeCRate: 0.15, maxDischargeCRate: 0.2 }),
  generic("generic-bat-gel-200", "battery", "Gel deep-cycle 12 V 200 Ah", { chemistry: "gel", dod: 0.5, unitVoltage: 12, unitAh: 200, maxChargeCRate: 0.15, maxDischargeCRate: 0.2 }),
  generic("generic-bat-agm-220", "battery", "AGM 12 V 220 Ah", { chemistry: "agm", dod: 0.5, unitVoltage: 12, unitAh: 220, maxChargeCRate: 0.2, maxDischargeCRate: 0.25 }),
  generic("generic-bat-lfp-12v-200", "battery", "LiFePO4 12.8 V 200 Ah", { chemistry: "lifepo4", dod: 0.9, unitVoltage: 12.8, unitAh: 200, maxChargeCRate: 0.5, maxDischargeCRate: 1 }),
  generic("generic-cc-30-100", "controller", "MPPT 30 A / 100 V", { ratedCurrentA: 30, maxPvVoltage: 100, maxPvPowerW: 0 }),
];
