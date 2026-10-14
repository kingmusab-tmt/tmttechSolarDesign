import type { BatterySettings, Handover, WarrantyItem } from "../schemas";
import { CHEMISTRY_INFO } from "./constants";
import { check, type Check } from "./types";

/* ---------------- Grid connection ---------------- */

export interface GridStep {
  key: string;
  label: string;
}

/** What has to be in place before the system runs alongside the utility supply. */
export const GRID_STEPS: Record<"backup" | "export", GridStep[]> = {
  backup: [
    { key: "no_backfeed", label: "Inverter set to zero export / no backfeed to the grid, and verified with the grid switched off" },
    { key: "transfer", label: "Transfer arrangement (inverter bypass or interlocked changeover) cannot connect the inverter output to the grid" },
    { key: "neutral_earth", label: "Neutral–earth link arrangement checked for both grid and backup modes" },
    { key: "disco_notified", label: "Distribution company (DisCo) informed of the installation where they require it" },
  ],
  export: [
    { key: "application", label: "Connection / export application submitted to the DisCo and approved in writing" },
    { key: "anti_islanding", label: "Inverter certified for anti-islanding (IEC 62116) and grid connection (IEC 61727 or the DisCo's equivalent)" },
    { key: "settings", label: "Voltage, frequency and reconnection settings agreed with the DisCo and set on the inverter" },
    { key: "meter", label: "Import/export (bidirectional) meter installed by the DisCo" },
    { key: "export_limit", label: "Export limit configured and tested with a CT / smart meter" },
    { key: "nemsa", label: "Installation inspected and certified by NEMSA" },
    { key: "labels", label: "Dual-supply warning labels at the meter, main board and inverter" },
  ],
};

/** Typical starting values for a 230 V / 50 Hz connection; the DisCo's requirements take precedence. */
export const GRID_SETTINGS: [string, string][] = [
  ["Over-voltage trip", "253 V (110 %) within 1.5 s"],
  ["Under-voltage trip", "207 V (90 %) within 1.5 s"],
  ["Over-frequency trip", "51.5 Hz within 0.5 s"],
  ["Under-frequency trip", "47.5 Hz within 0.5 s"],
  ["Reconnection delay", "≥ 60 s after the grid is back within limits"],
  ["Anti-islanding", "Disconnect within 2 s of loss of mains (IEC 62116)"],
];

export function computeGrid(h: Handover, gridAvailable: boolean) {
  const mode = gridAvailable ? h.grid.connection : "none";
  const steps = mode === "none" ? [] : GRID_STEPS[mode];
  const done = steps.filter((s) => h.grid.steps[s.key]).length;
  const checks: Check[] = [];
  if (mode !== "none") {
    checks.push(check("handover", "gr-steps", mode === "export" ? "Grid export approved and set up" : "No backfeed to the grid", done === steps.length, `${done} of ${steps.length} grid-connection items done`, "warn"));
    if (mode === "export") checks.push(check("handover", "gr-limit", "Export limit recorded", h.grid.exportLimitW > 0, h.grid.exportLimitW > 0 ? `${h.grid.exportLimitW} W` : "Enter the export limit approved by the DisCo", "warn"));
  }
  return { mode, steps, done, checks };
}

/* ---------------- Operation & maintenance ---------------- */

export interface MaintenanceTask {
  interval: string;
  task: string;
  by: "Owner" | "Technician";
}

export function maintenancePlan(x: { battery: BatterySettings; batteryLifeYears: number; inverterLifeYears: number; hasController: boolean; ground: boolean }): MaintenanceTask[] {
  const flooded = x.battery.chemistry === "lead_acid";
  const tasks: MaintenanceTask[] = [
    { interval: "Weekly", task: "Check the inverter display / monitoring app for alarms and that daily solar production looks normal", by: "Owner" },
    { interval: "Every 2–4 weeks (dry season / harmattan)", task: "Rinse dust off the modules with clean water early morning or evening; never use abrasives or a high-pressure jet", by: "Owner" },
    { interval: "Monthly", task: "Keep the battery and inverter area clean, dry and ventilated; check for heat, smells or swelling", by: "Owner" },
    ...(flooded ? [{ interval: "Monthly", task: "Check electrolyte levels and top up with distilled water; check specific gravity", by: "Technician" as const }] : []),
    { interval: "Every 6 months", task: "Inspect modules, frames and clamps for damage, corrosion and loose fixings; check cable ties and UV damage", by: "Technician" },
    { interval: "Every 6 months", task: "Check terminal torque and look for hot spots on DC and battery connections (thermal camera if available)", by: "Technician" },
    { interval: "Annually", task: "Repeat insulation-resistance, Voc/Isc and earth-electrode tests; compare with the commissioning record", by: "Technician" },
    { interval: "Annually", task: "Check surge protector status windows, RCD trip test (test button and instrument), and update inverter/BMS firmware", by: "Technician" },
    { interval: "Annually", task: x.ground ? "Check posts, footings and frame bracing; clear vegetation that could shade the array" : "Check roof penetrations and seals for leaks; trim trees that have grown into the sun path", by: "Technician" },
    ...(x.hasController ? [{ interval: "Annually", task: "Check charge controller settings and logs", by: "Technician" as const }] : []),
    { interval: `Year ${Math.max(1, Math.round(x.batteryLifeYears))}`, task: `Plan battery replacement (${CHEMISTRY_INFO[x.battery.chemistry].label} expected life); test capacity from year ${Math.max(1, Math.round(x.batteryLifeYears) - 1)}`, by: "Technician" },
    { interval: `Year ${Math.max(1, Math.round(x.inverterLifeYears))}`, task: "Plan inverter replacement or refurbishment", by: "Technician" },
  ];
  return tasks;
}

/* ---------------- Warranty register ---------------- */

export function suggestedWarranties(x: { panelName: string; panels: number; inverterName: string; batteryName: string; batteryUnits: number; batteryChemistry: BatterySettings["chemistry"]; controllerName: string; controllers: number }): Omit<WarrantyItem, "id">[] {
  const rows: Omit<WarrantyItem, "id">[] = [
    { item: "PV modules (product warranty; 25-year power warranty usually separate)", make: "", model: x.panelName, serial: "", quantity: x.panels, warrantyYears: 12 },
    { item: "Inverter", make: "", model: x.inverterName, serial: "", quantity: 1, warrantyYears: 5 },
    { item: "Batteries", make: "", model: x.batteryName, serial: "", quantity: x.batteryUnits, warrantyYears: x.batteryChemistry === "lifepo4" ? 10 : 2 },
  ];
  if (x.controllers > 0) rows.push({ item: "Charge controller", make: "", model: x.controllerName, serial: "", quantity: x.controllers, warrantyYears: 5 });
  rows.push({ item: "Installation workmanship", make: "", model: "", serial: "", quantity: 1, warrantyYears: 1 });
  return rows;
}

export function handoverChecks(h: Handover): Check[] {
  const missingSerials = h.warranties.filter((w) => !w.serial.trim()).length;
  return [
    check("handover", "ho-warranty", "Warranty register complete", h.warranties.length > 0 && missingSerials === 0, h.warranties.length === 0 ? "No equipment registered yet" : missingSerials ? `${missingSerials} item(s) without a serial number` : `${h.warranties.length} items registered`, "warn"),
    check("handover", "ho-signed", "Handover recorded", Boolean(h.handoverDate && h.receivedBy.trim()), h.handoverDate && h.receivedBy ? `Received by ${h.receivedBy} on ${h.handoverDate}` : "Enter the handover date and who received the system", "warn"),
  ];
}
