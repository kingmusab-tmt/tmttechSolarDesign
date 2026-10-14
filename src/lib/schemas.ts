import { z } from "zod";

/**
 * Single source of truth for every design section: runtime validation (API PATCH),
 * TypeScript types (z.infer) and defaults (schema.parse({})).
 */

const n = (def: number, min = -1e9, max = 1e12) => z.number().finite().min(min).max(max).default(def);
const s = (def = "") => z.string().max(2000).default(def);
const b = (def = false) => z.boolean().default(def);
const id = () => z.string().max(64).default(() => Math.random().toString(36).slice(2, 10));

export const PROJECT_STATUSES = ["draft", "designing", "review", "approved", "installed", "commissioned"] as const;
export const ProjectStatusSchema = z.enum(PROJECT_STATUSES);
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

export const ClientSchema = z.object({
  name: s(),
  phone: s(),
  email: s(),
  address: s(),
});

export const SiteSchema = z.object({
  locationPreset: s("lagos"),
  city: s("Lagos"),
  state: s("Lagos"),
  country: s("Nigeria"),
  latitude: n(6.52, -90, 90),
  longitude: n(3.38, -180, 180),
  peakSunHours: n(4.5, 0.5, 12),
  tMin: n(18, -60, 50),
  tMax: n(35, -20, 60),
  gridAvailable: b(true),
  monthlyPsh: z.array(z.number().finite().min(0).max(15)).max(12).default([]),
  climateSource: s("Location preset"),
  /** Per-source detail from the last satellite import (kept for transparency and the yield cross-check). */
  climateDetail: z
    .object({
      method: z.enum(["none", "average", "gsa", "nasa"]).default("none"),
      gsaPsh: z.array(z.number().finite()).max(12).default([]),
      nasaPsh: z.array(z.number().finite()).max(12).default([]),
      gsaPvoutPerDay: z.array(z.number().finite()).max(12).default([]),
      gsaAnnualPvout: n(0, 0, 5000),
      optimalTiltDeg: n(0, 0, 90),
      disagreeMonths: z.array(z.number().int().min(0).max(11)).max(12).default([]),
      fetchedAt: s(),
    })
    .prefault({}),
  notes: s(),
});

export const LOAD_CATEGORIES = ["Lighting", "Cooling", "Refrigeration", "Entertainment", "Kitchen", "Office/IT", "Pumping", "Other"] as const;

export const LoadItemSchema = z.object({
  id: id(),
  name: s("Appliance"),
  category: s("Other"),
  watts: n(0, 0, 1e6),
  qty: n(1, 0, 10000),
  hoursPerDay: n(0, 0, 24),
  inductive: b(false),
  surgeFactor: n(3, 1, 10),
});
export const LoadsSchema = z.array(LoadItemSchema).max(500).default([]);

export const InverterSpecSchema = z.object({
  brand: s(),
  model: s(),
  ratedPowerW: n(0, 0, 1e7), // 0 = use recommended size
  surgePowerW: n(0, 0, 1e7),
  maxPvVoltage: n(500, 0, 2000),
  mpptMinV: n(120, 0, 2000),
  mpptMaxV: n(450, 0, 2000),
  maxPvPowerW: n(6500, 0, 1e7),
  maxPvInputCurrentA: n(22, 0, 1000), // per MPPT, operating
  maxPvIscA: n(27, 0, 1000), // per MPPT, short-circuit
  mpptCount: n(1, 1, 12),
  maxChargeCurrentA: n(100, 0, 2000),
});

export const InverterSchema = z.object({
  type: z.enum(["hybrid", "standalone"]).default("hybrid"),
  margin: n(1.25, 1, 3),
  demandFactor: n(1, 0.1, 1),
  systemVoltage: z.union([z.literal(0), z.literal(12), z.literal(24), z.literal(48)]).default(0), // 0 = auto
  efficiency: n(0.9, 0.5, 1),
  selected: InverterSpecSchema.prefault({}),
});

export const BATTERY_CHEMISTRIES = ["lead_acid", "gel", "agm", "lifepo4"] as const;
export const BatterySchema = z.object({
  chemistry: z.enum(BATTERY_CHEMISTRIES).default("lifepo4"),
  dod: n(0.9, 0.1, 1),
  daysOfAutonomy: n(1, 0.1, 10),
  brand: s(),
  model: s(),
  unitVoltage: n(12.8, 1, 1000),
  unitAh: n(200, 1, 10000),
  maxChargeCRate: n(0.5, 0.01, 5),
  maxDischargeCRate: n(1, 0.01, 5),
});

export const PanelSpecSchema = z.object({
  brand: s("Generic"),
  model: s("Mono PERC 450W"),
  pmaxW: n(450, 1, 2000),
  vocV: n(49.6, 1, 200),
  vmpV: n(41.4, 1, 200),
  iscA: n(11.6, 0.1, 50),
  impA: n(10.87, 0.1, 50),
  betaVocPct: n(-0.27, -2, 0), // %/°C
  gammaPmaxPct: n(-0.35, -2, 0), // %/°C, used for Vmp at high temperature
  noctC: n(45, 20, 70),
  lengthM: n(2.094, 0.1, 5),
  widthM: n(1.038, 0.1, 5),
  weightKg: n(23.5, 0.1, 200),
});

export const PvSchema = z.object({
  systemEfficiency: n(0.75, 0.4, 1),
  panel: PanelSpecSchema.prefault({}),
});

export const StringsSchema = z.object({
  seriesOverride: n(0, 0, 100), // 0 = auto
  parallelOverride: n(0, 0, 200), // 0 = auto
});

export const ControllerSchema = z.object({
  margin: n(1.25, 1, 3),
  brand: s(),
  model: s(),
  ratedCurrentA: n(0, 0, 1000), // 0 = use recommended size
  maxPvVoltage: n(150, 0, 2000),
  maxPvPowerW: n(0, 0, 1e7),
});

export const CablesSchema = z.object({
  pvStringLengthM: n(15, 0, 1000),
  pvArrayLengthM: n(10, 0, 1000),
  ctrlBattLengthM: n(2, 0, 1000),
  battInvLengthM: n(2, 0, 1000),
  acOutLengthM: n(10, 0, 1000),
  acInLengthM: n(10, 0, 1000),
  dcDropPct: n(3, 0.1, 10),
  batteryDropPct: n(1, 0.1, 10),
  acDropPct: n(3, 0.1, 10),
  acVoltage: n(230, 100, 480),
  // Derating (IEC 60364-5-52): air temperature around the cables, installation method and grouping.
  indoorAmbientC: n(0, 0, 80), // 0 = use the site's record high temperature
  roofAmbientC: n(70, 20, 90), // PV cables on the roof / behind modules in the sun
  installMethod: z.enum(["air", "clipped", "conduit", "insulated"]).default("conduit"),
  bunchStrings: b(true), // PV string cables run together in one tray or conduit
  finalCircuitLengthM: n(20, 1, 500), // typical run from the essential-loads board to the furthest point
  inverterFaultFactor: n(2, 1, 20), // inverter short-circuit output as a multiple of rated current (datasheet)
});

export const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
export const ObstructionSchema = z.object({
  id: id(),
  description: s("Tree"),
  direction: z.enum(COMPASS).default("S"),
  heightM: n(5, 0, 500),
  distanceM: n(10, 0.1, 5000),
});

export const AssessmentSchema = z.object({
  shadingMethod: z.enum(["solar_pathfinder", "digital_model", "visual"]).default("visual"),
  shadingLossPct: n(0, 0, 80),
  obstructions: z.array(ObstructionSchema).max(100).default([]),
  roofType: z.enum(["metal", "concrete", "tile", "asbestos", "ground"]).default("metal"),
  roofPitchDeg: n(15, 0, 90),
  roofAzimuthDeg: n(180, 0, 360),
  roofLengthM: n(10, 0.5, 500), // along the eave (horizontal)
  roofWidthM: n(6, 0.5, 500), // up the slope
  roofAllowableLoadKgM2: n(25, 0, 1000),
  windSpeedMs: n(28, 0, 80), // basic wind velocity vb (10-min mean at 10 m); ~40 m/s 3-s gust
  attachmentCapacityKN: n(2, 0.1, 100), // design pull-out capacity of one roof hook / L-foot / anchor
  // Lightning screening (IEC 62305-2)
  groundFlashDensity: n(10, 0.1, 80), // Ng, flashes/km²/year (much of Nigeria 5–20)
  buildingHeightM: n(4, 1, 300),
  surroundings: z.enum(["surrounded_taller", "similar", "isolated", "hilltop"]).default("similar"),
  overheadSupply: b(true), // building fed by an overhead line
  mountingWeightKgM2: n(3, 0, 100),
  roofCondition: z.enum(["good", "fair", "poor"]).default("good"),
  busbarRatingA: n(100, 0, 5000),
  mainBreakerA: n(63, 0, 5000),
  spareWays: n(2, 0, 100),
  earthResistanceOhm: n(0, 0, 1000), // 0 = not yet measured
  notes: s(),
});

export const MOUNT_TYPES = ["auto", "flat", "ground", "gable", "shed"] as const;

export const LayoutSchema = z.object({
  /** How the array is mounted; "auto" follows the site assessment (ground, flat below 5°, else gable). */
  mountType: z.enum(MOUNT_TYPES).default("auto"),
  flatFixing: z.enum(["ballast", "anchored"]).default("ballast"), // flat roofs: ballast blocks or chemical anchors
  orientation: z.enum(["portrait", "landscape"]).default("portrait"),
  setbackM: n(0.5, 0, 5),
  gapM: n(0.02, 0, 1),
  rowGapM: n(0.3, 0, 5),
});

export const ComplianceSchema = z.object({
  items: z.record(z.string(), z.object({ checked: b(false), notes: s() })).default({}),
  engineerName: s(),
  corenNumber: s(),
  signOffDate: s(),
});

export const BoqExtraSchema = z.object({
  id: id(),
  category: s("Other"),
  description: s("Item"),
  unit: s("pcs"),
  qty: n(1, 0, 1e6),
  unitPrice: n(0, 0, 1e12),
});

export const BoqSchema = z.object({
  prices: z.record(z.string(), z.number().finite().min(0)).default({}),
  qtyOverrides: z.record(z.string(), z.number().finite().min(0)).default({}),
  extras: z.array(BoqExtraSchema).max(200).default([]),
  contingencyPct: n(5, 0, 100),
  vatPct: n(7.5, 0, 100),
  currency: s("NGN"),
});

export const FinancialSchema = z.object({
  monthlyGridCost: n(30000, 0, 1e12),
  monthlyGeneratorCost: n(80000, 0, 1e12),
  displacementPct: n(90, 0, 100),
  escalationPct: n(12, -50, 200),
  discountRatePct: n(15, 0, 100),
  omPctOfCapex: n(1, 0, 50),
  degradationPct: n(0.5, 0, 5),
  lifetimeYears: n(25, 1, 40),
  batteryLifeYears: n(0, 0, 40), // 0 = auto by chemistry
  inverterLifeYears: n(10, 0, 40),
});

/* ---------- Commissioning & handover (after installation) ---------- */

/** Measured at commissioning for one string (IEC 62446-1). 0 = not measured yet. */
export const StringTestSchema = z.object({
  vocV: n(0, 0, 2000),
  iscA: n(0, 0, 100),
  irradianceWm2: n(0, 0, 1500), // plane-of-array irradiance during the Isc test
  cellTempC: n(0, -20, 100), // module temperature during the Voc test
  polarityOk: b(false),
  insulationMOhm: n(0, 0, 100000),
});

export const GridConnectionSchema = z.object({
  connection: z.enum(["none", "backup", "export"]).default("backup"), // no grid, grid as backup/charging, or exporting
  disco: s(), // electricity distribution company
  accountNumber: s(),
  meterNumber: s(),
  exportLimitW: n(0, 0, 1e7),
  applicationRef: s(),
  steps: z.record(z.string(), b(false)).default({}),
});

export const WarrantyItemSchema = z.object({
  id: id(),
  item: s("Equipment"),
  make: s(),
  model: s(),
  serial: s(),
  quantity: n(1, 0, 10000),
  warrantyYears: n(0, 0, 50),
});

export const HandoverSchema = z.object({
  stringTests: z.record(z.string(), StringTestSchema).default({}),
  earthOhm: n(0, 0, 10000),
  rcdTripMs: n(0, 0, 5000), // trip time at the rated residual current IΔn
  acVoltageV: n(0, 0, 1000),
  functional: z.record(z.string(), b(false)).default({}),
  testedBy: s(),
  testDate: s(),
  instrument: s(),
  grid: GridConnectionSchema.prefault({}),
  warranties: z.array(WarrantyItemSchema).max(200).default([]),
  handoverDate: s(),
  receivedBy: s(),
  notes: s(),
});

export const STEP_KEYS = [
  "site",
  "loads",
  "inverter",
  "battery",
  "pv",
  "strings",
  "controller",
  "cables",
  "assessment",
  "layout",
  "sld",
  "compliance",
  "boq",
  "financial",
  "handover",
  "report",
] as const;
export type StepKey = (typeof STEP_KEYS)[number];

export const ProgressSchema = z.record(z.string(), z.boolean()).default({});

export const SECTION_SCHEMAS = {
  client: ClientSchema,
  site: SiteSchema,
  loads: LoadsSchema,
  inverter: InverterSchema,
  battery: BatterySchema,
  pv: PvSchema,
  strings: StringsSchema,
  controller: ControllerSchema,
  cables: CablesSchema,
  assessment: AssessmentSchema,
  layout: LayoutSchema,
  compliance: ComplianceSchema,
  boq: BoqSchema,
  financial: FinancialSchema,
  handover: HandoverSchema,
  progress: ProgressSchema,
} as const;

export type SectionKey = keyof typeof SECTION_SCHEMAS;
export const SECTION_KEYS = Object.keys(SECTION_SCHEMAS) as SectionKey[];

export type Client = z.infer<typeof ClientSchema>;
export type Site = z.infer<typeof SiteSchema>;
export type LoadItem = z.infer<typeof LoadItemSchema>;
export type InverterSettings = z.infer<typeof InverterSchema>;
export type InverterSpec = z.infer<typeof InverterSpecSchema>;
export type BatterySettings = z.infer<typeof BatterySchema>;
export type PanelSpec = z.infer<typeof PanelSpecSchema>;
export type PvSettings = z.infer<typeof PvSchema>;
export type StringSettings = z.infer<typeof StringsSchema>;
export type ControllerSettings = z.infer<typeof ControllerSchema>;
export type CableSettings = z.infer<typeof CablesSchema>;
export type Obstruction = z.infer<typeof ObstructionSchema>;
export type Assessment = z.infer<typeof AssessmentSchema>;
export type LayoutSettings = z.infer<typeof LayoutSchema>;
export type Compliance = z.infer<typeof ComplianceSchema>;
export type BoqExtra = z.infer<typeof BoqExtraSchema>;
export type BoqSettings = z.infer<typeof BoqSchema>;
export type FinancialSettings = z.infer<typeof FinancialSchema>;
export type StringTest = z.infer<typeof StringTestSchema>;
export type GridConnection = z.infer<typeof GridConnectionSchema>;
export type WarrantyItem = z.infer<typeof WarrantyItemSchema>;
export type Handover = z.infer<typeof HandoverSchema>;

export interface DesignInputs {
  client: Client;
  site: Site;
  loads: LoadItem[];
  inverter: InverterSettings;
  battery: BatterySettings;
  pv: PvSettings;
  strings: StringSettings;
  controller: ControllerSettings;
  cables: CableSettings;
  assessment: Assessment;
  layout: LayoutSettings;
  compliance: Compliance;
  boq: BoqSettings;
  financial: FinancialSettings;
  handover: Handover;
  progress: Record<string, boolean>;
}

export interface ProjectData extends DesignInputs {
  _id: string;
  name: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

/** Parse one stored section, falling back to defaults if stored data is malformed. */
export function parseSection<K extends SectionKey>(key: K, raw: unknown): z.infer<(typeof SECTION_SCHEMAS)[K]> {
  const schema = SECTION_SCHEMAS[key] as z.ZodType;
  const res = schema.safeParse(raw ?? (key === "loads" ? [] : {}));
  if (res.success) return res.data as z.infer<(typeof SECTION_SCHEMAS)[K]>;
  return schema.parse(key === "loads" ? [] : {}) as z.infer<(typeof SECTION_SCHEMAS)[K]>;
}

export function defaultInputs(): DesignInputs {
  const out = {} as Record<string, unknown>;
  for (const k of SECTION_KEYS) out[k] = parseSection(k, undefined);
  return out as unknown as DesignInputs;
}

/** Normalise a raw Mongo document (or plain object) into a fully populated ProjectData. */
export function normalizeProject(raw: Record<string, unknown>): ProjectData {
  const out = {} as Record<string, unknown>;
  for (const k of SECTION_KEYS) out[k] = parseSection(k, raw[k]);
  const status = ProjectStatusSchema.safeParse(raw.status);
  return {
    ...(out as unknown as DesignInputs),
    _id: String(raw._id ?? ""),
    name: String(raw.name ?? "Untitled project"),
    status: status.success ? status.data : "draft",
    createdAt: raw.createdAt ? new Date(raw.createdAt as string).toISOString() : new Date().toISOString(),
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt as string).toISOString() : new Date().toISOString(),
  };
}

export const ProjectPatchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  status: ProjectStatusSchema.optional(),
  sections: z.record(z.string(), z.unknown()).optional(),
});
