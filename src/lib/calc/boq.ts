import type { BatterySettings, BoqSettings, CableSettings, InverterSettings, PanelSpec, Site } from "../schemas";
import type { CableResult } from "./cables";
import type { LayoutResult } from "./site";
import type { BatteryResult, ControllerResult, InverterResult, StringResult } from "./sizing";

export interface BoqItem {
  key: string;
  category: string;
  description: string;
  unit: string;
  qty: number;
  unitPrice: number;
  total: number;
  auto: boolean;
}

export interface BoqResult {
  items: BoqItem[];
  categories: { category: string; total: number }[];
  subtotal: number;
  contingency: number;
  vat: number;
  grandTotal: number;
  batteryCost: number;
  inverterCost: number;
  costPerWp: number;
}

/** Indicative Nigerian market prices (NGN). Every price can be overridden per project. */
export const PRICE_BASIS = {
  panelPerW: 300,
  hybridInverterPerW: 200,
  standaloneInverterPerW: 150,
  batteryPerKWh: { lead_acid: 160000, gel: 190000, agm: 175000, lifepo4: 320000 } as Record<string, number>,
  controllerPerA: 5000,
};

/** Approximate price per metre of single-core copper cable of a given size. */
export function cablePricePerM(sizeMm2: number) {
  return Math.round(250 + 450 * sizeMm2);
}

interface BoqInputs {
  boq: BoqSettings;
  site: Site;
  panel: PanelSpec;
  inverterSettings: InverterSettings;
  inverter: InverterResult;
  batterySettings: BatterySettings;
  battery: BatteryResult;
  strings: StringResult;
  controller: ControllerResult;
  cables: CableResult;
  cableSettings: CableSettings;
  layout: LayoutResult;
}

export function computeBoq(x: BoqInputs): BoqResult {
  const { boq, panel, inverter, inverterSettings, battery, batterySettings, strings, controller, cables, layout, site } = x;
  const items: BoqItem[] = [];
  const add = (key: string, category: string, description: string, unit: string, qty: number, unitPrice: number) => {
    const q = boq.qtyOverrides[key] ?? qty;
    const p = boq.prices[key] ?? unitPrice;
    if (q <= 0 && boq.qtyOverrides[key] === undefined) return;
    items.push({ key, category, description, unit, qty: q, unitPrice: p, total: q * p, auto: true });
  };

  const seg = (k: string) => cables.segments.find((s) => s.key === k);
  const nPanels = strings.totalPanels;
  const nStrings = strings.parallel;
  const mppts = Math.max(1, Math.min(strings.device.mpptCount, nStrings));

  // Generation
  add("pv_module", "PV generation", `PV module ${panel.brand} ${panel.model} ${panel.pmaxW} Wp (IEC 61215/61730)`, "pcs", nPanels, panel.pmaxW * PRICE_BASIS.panelPerW);

  // Power conversion
  const invName = inverterSettings.selected.model ? `${inverterSettings.selected.brand} ${inverterSettings.selected.model}` : `${inverterSettings.type === "hybrid" ? "Hybrid" : "Pure sine wave"} inverter`;
  add("inverter", "Power conversion", `${invName} ${inverter.ratedPowerW / 1000} kW, ${inverter.systemVoltage} V DC (IEC 62109)`, "pcs", 1, inverter.ratedPowerW * (inverterSettings.type === "hybrid" ? PRICE_BASIS.hybridInverterPerW : PRICE_BASIS.standaloneInverterPerW));
  if (controller.applicable) add("controller", "Power conversion", `MPPT charge controller ${controller.ratedA} A`, "pcs", controller.count, controller.ratedA * PRICE_BASIS.controllerPerA);

  // Storage
  const unitKWh = (batterySettings.unitVoltage * batterySettings.unitAh) / 1000;
  add("battery", "Energy storage", `Battery ${batterySettings.brand} ${batterySettings.model} ${batterySettings.unitVoltage} V ${batterySettings.unitAh} Ah (${batterySettings.chemistry.replace("_", "-")})`.replace(/\s+/g, " "), "pcs", battery.totalUnits, Math.round(unitKWh * (PRICE_BASIS.batteryPerKWh[batterySettings.chemistry] ?? 200000)));
  add("battery_rack", "Energy storage", "Battery rack / cabinet", "pcs", 1, 60000);
  const battSeg = seg("batt_inv");
  add("battery_links", "Energy storage", `Battery interconnect links ${battSeg?.sizeMm2 ?? 25} mm² with lugs`, "pcs", Math.max(0, battery.totalUnits - 1) + (battery.parallelCount > 1 ? 2 : 0), 8000);

  // Mounting
  add("rail", "Mounting structure", "Aluminium mounting rail 4.2 m", "pcs", layout.railPieces, 28000);
  add("rail_splice", "Mounting structure", "Rail splice kit", "pcs", layout.railSplices, 2500);
  add("mid_clamp", "Mounting structure", "Mid clamp (module-to-module)", "pcs", layout.midClamps, 1500);
  add("end_clamp", "Mounting structure", "End clamp", "pcs", layout.endClamps, 1500);
  add("roof_hook", "Mounting structure", "Roof attachment (L-foot / hook) with EPDM seal", "pcs", layout.roofAttachments, 3500);
  add("earth_clip", "Mounting structure", "Module earthing clip / WEEB", "pcs", nPanels, 800);

  // DC cabling & protection
  const pvStr = seg("pv_string");
  const pvArr = seg("pv_array");
  if (pvStr) add("cable_pv_string", "DC cabling & protection", `PV cable ${pvStr.sizeMm2} mm² (EN 50618, red + black)`, "m", Math.ceil(2 * pvStr.lengthM * nStrings * 1.1), cablePricePerM(pvStr.sizeMm2));
  if (pvArr) add("cable_pv_array", "DC cabling & protection", `PV home-run cable ${pvArr.sizeMm2} mm² (red + black)`, "m", Math.ceil(2 * pvArr.lengthM * mppts * 1.1), cablePricePerM(pvArr.sizeMm2));
  add("mc4", "DC cabling & protection", "MC4 connector pair (IP67/IP68, 1000 V+)", "pairs", Math.ceil((nStrings * 2 + 2) * 1.1), 2000);
  if (strings.stringsPerMppt === 2) add("mc4_branch", "DC cabling & protection", "MC4 Y-branch connector set", "sets", mppts, 5000);
  if (cables.stringFuseA > 0) {
    add("combiner", "DC cabling & protection", "PV combiner box (IP65) with fuse holders", "pcs", mppts, 85000);
    add("string_fuse", "DC cabling & protection", `gPV string fuse ${cables.stringFuseA} A, 1000 V DC`, "pcs", nStrings * 2, 3000);
  }
  add("dc_isolator", "DC cabling & protection", `DC isolator / breaker ${cables.dcIsolatorA} A, ${cables.dcIsolatorV} V DC`, "pcs", mppts, 25000);
  add("dc_spd", "DC cabling & protection", `Type II DC SPD, Ucpv ${cables.dcSpdUcpv} V`, "pcs", mppts, 35000);
  const cc = seg("ctrl_batt");
  if (cc) add("cable_ctrl_batt", "DC cabling & protection", `Controller–battery cable ${cc.sizeMm2} mm² (red + black)`, "m", Math.ceil(2 * cc.lengthM * cc.runs * 1.1), cablePricePerM(cc.sizeMm2));
  if (cc) add("ctrl_breaker", "DC cabling & protection", `DC breaker ${cc.protectionA} A (controller output)`, "pcs", cc.runs, 20000);
  if (battSeg) add("cable_batt_inv", "DC cabling & protection", `Battery cable ${battSeg.sizeMm2} mm² flexible (red + black)`, "m", Math.ceil(2 * battSeg.lengthM * 1.1), cablePricePerM(battSeg.sizeMm2));
  add("battery_fuse", "DC cabling & protection", `Battery fuse ${cables.batteryFuseA} A (Class T / NH) with holder`, "pcs", 1, 45000);
  add("battery_isolator", "DC cabling & protection", `Battery isolator switch ≥ ${cables.batteryFuseA} A`, "pcs", 1, 30000);

  // AC cabling & protection
  const acOut = seg("ac_out");
  if (acOut) add("cable_ac_out", "AC cabling & protection", `AC cable ${acOut.sizeMm2} mm² 3-core (L, N, PE)`, "m", Math.ceil(acOut.lengthM * 1.1), 3 * cablePricePerM(acOut.sizeMm2));
  const acIn = seg("ac_in");
  if (acIn) add("cable_ac_in", "AC cabling & protection", `AC input cable ${acIn.sizeMm2} mm² 3-core`, "m", Math.ceil(acIn.lengthM * 1.1), 3 * cablePricePerM(acIn.sizeMm2));
  add("ac_breaker", "AC cabling & protection", `Double-pole MCB ${cables.acBreakerA} A`, "pcs", site.gridAvailable ? 2 : 1, 12000);
  add("ac_spd", "AC cabling & protection", cables.acSpd, "pcs", 1, 30000);
  if (site.gridAvailable && controller.applicable) add("changeover", "AC cabling & protection", `Changeover switch ${cables.acBreakerA} A`, "pcs", 1, 45000);
  add("ac_db", "AC cabling & protection", "Solar distribution board / enclosure (IP65)", "pcs", 1, 40000);

  // Earthing & lightning
  add("earth_rod", "Earthing & lightning", cables.earthing.electrode, "pcs", 2, 18000);
  add("earth_cable_main", "Earthing & lightning", `Earth conductor ${cables.earthing.mainEarthMm2} mm² green/yellow`, "m", 20, cablePricePerM(cables.earthing.mainEarthMm2));
  add("earth_cable_bond", "Earthing & lightning", `Equipotential bonding conductor ${cables.earthing.bondingMm2} mm² green/yellow`, "m", Math.ceil(layout.railLengthM / 2 + 10), cablePricePerM(cables.earthing.bondingMm2));
  add("earth_bar", "Earthing & lightning", "Main earthing terminal / earth bar", "pcs", 1, 8000);
  add("earth_pit", "Earthing & lightning", "Earth inspection pit", "pcs", 1, 15000);

  // Accessories
  add("lugs", "Accessories", "Cable lugs & ferrules (assorted, tinned copper)", "sets", 1 + Math.ceil(battery.totalUnits / 4), 15000);
  add("cable_ties", "Accessories", "UV-resistant cable ties (pack of 100)", "packs", Math.ceil(nPanels / 10) + 1, 4500);
  add("conduit", "Accessories", "UV-stable conduit / trunking with fittings", "m", Math.ceil((pvArr?.lengthM ?? 0) * mppts + (acOut?.lengthM ?? 0) + (acIn?.lengthM ?? 0) + 5), 1200);
  add("labels", "Accessories", "Warning labels & signage set (IEC 60364-7-712)", "sets", 1, 15000);

  // Labour & services
  add("labour", "Labour & services", "Installation labour", "lot", 1, 150000 + nPanels * 20000 + battery.totalUnits * 5000);
  add("commissioning", "Labour & services", "Testing & commissioning (IEC 62446-1)", "lot", 1, 100000);
  add("design_fee", "Labour & services", "Engineering design & COREN sign-off", "lot", 1, 150000);
  add("logistics", "Labour & services", "Transport & logistics", "lot", 1, 50000);

  for (const e of boq.extras) items.push({ key: `extra_${e.id}`, category: e.category || "Other", description: e.description, unit: e.unit, qty: e.qty, unitPrice: e.unitPrice, total: e.qty * e.unitPrice, auto: false });

  const subtotal = items.reduce((a, i) => a + i.total, 0);
  const contingency = subtotal * (boq.contingencyPct / 100);
  const vat = (subtotal + contingency) * (boq.vatPct / 100);
  const grandTotal = subtotal + contingency + vat;
  const catMap = new Map<string, number>();
  for (const i of items) catMap.set(i.category, (catMap.get(i.category) ?? 0) + i.total);
  const pick = (k: string) => items.find((i) => i.key === k)?.total ?? 0;

  return {
    items,
    categories: [...catMap.entries()].map(([category, total]) => ({ category, total })),
    subtotal,
    contingency,
    vat,
    grandTotal,
    batteryCost: pick("battery"),
    inverterCost: pick("inverter") + pick("controller"),
    costPerWp: strings.arrayW > 0 ? grandTotal / strings.arrayW : 0,
  };
}
