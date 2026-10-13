import type { LoadItem } from "./schemas";

export interface AppliancePreset {
  name: string;
  category: string;
  watts: number;
  hoursPerDay: number;
  inductive: boolean;
  surgeFactor: number;
}

/** Typical ratings for quick entry. Always confirm against the nameplate. */
export const APPLIANCE_PRESETS: AppliancePreset[] = [
  { name: "LED bulb", category: "Lighting", watts: 10, hoursPerDay: 6, inductive: false, surgeFactor: 1 },
  { name: "LED tube (4 ft)", category: "Lighting", watts: 18, hoursPerDay: 6, inductive: false, surgeFactor: 1 },
  { name: "Security light (LED flood)", category: "Lighting", watts: 30, hoursPerDay: 12, inductive: false, surgeFactor: 1 },
  { name: "Ceiling fan", category: "Cooling", watts: 75, hoursPerDay: 8, inductive: true, surgeFactor: 2 },
  { name: "Standing fan", category: "Cooling", watts: 55, hoursPerDay: 8, inductive: true, surgeFactor: 2 },
  { name: "Air conditioner 1 HP (inverter)", category: "Cooling", watts: 900, hoursPerDay: 6, inductive: true, surgeFactor: 1.5 },
  { name: "Air conditioner 1.5 HP", category: "Cooling", watts: 1300, hoursPerDay: 6, inductive: true, surgeFactor: 3 },
  { name: "Refrigerator (medium)", category: "Refrigeration", watts: 150, hoursPerDay: 12, inductive: true, surgeFactor: 3 },
  { name: "Chest freezer", category: "Refrigeration", watts: 200, hoursPerDay: 12, inductive: true, surgeFactor: 3 },
  { name: "Inverter refrigerator", category: "Refrigeration", watts: 100, hoursPerDay: 14, inductive: true, surgeFactor: 1.5 },
  { name: "LED TV 43\"", category: "Entertainment", watts: 80, hoursPerDay: 6, inductive: false, surgeFactor: 1 },
  { name: "Decoder / set-top box", category: "Entertainment", watts: 20, hoursPerDay: 6, inductive: false, surgeFactor: 1 },
  { name: "Sound system", category: "Entertainment", watts: 100, hoursPerDay: 3, inductive: false, surgeFactor: 1 },
  { name: "Laptop", category: "Office/IT", watts: 65, hoursPerDay: 6, inductive: false, surgeFactor: 1 },
  { name: "Desktop computer + monitor", category: "Office/IT", watts: 250, hoursPerDay: 6, inductive: false, surgeFactor: 1 },
  { name: "Wi-Fi router", category: "Office/IT", watts: 12, hoursPerDay: 24, inductive: false, surgeFactor: 1 },
  { name: "Phone charger", category: "Office/IT", watts: 10, hoursPerDay: 3, inductive: false, surgeFactor: 1 },
  { name: "Printer (laser)", category: "Office/IT", watts: 400, hoursPerDay: 0.5, inductive: false, surgeFactor: 1 },
  { name: "Microwave oven", category: "Kitchen", watts: 1000, hoursPerDay: 0.3, inductive: false, surgeFactor: 1.5 },
  { name: "Blender", category: "Kitchen", watts: 400, hoursPerDay: 0.2, inductive: true, surgeFactor: 3 },
  { name: "Electric kettle", category: "Kitchen", watts: 1500, hoursPerDay: 0.2, inductive: false, surgeFactor: 1 },
  { name: "Pressing iron", category: "Other", watts: 1000, hoursPerDay: 0.3, inductive: false, surgeFactor: 1 },
  { name: "Washing machine", category: "Other", watts: 500, hoursPerDay: 1, inductive: true, surgeFactor: 3 },
  { name: "Water pump 1 HP", category: "Pumping", watts: 750, hoursPerDay: 1, inductive: true, surgeFactor: 3 },
  { name: "Water pump 0.5 HP", category: "Pumping", watts: 370, hoursPerDay: 1, inductive: true, surgeFactor: 3 },
  { name: "CCTV system (4 cameras + DVR)", category: "Other", watts: 40, hoursPerDay: 24, inductive: false, surgeFactor: 1 },
];

export function presetToLoad(p: AppliancePreset, qty = 1): LoadItem {
  return { id: Math.random().toString(36).slice(2, 10), name: p.name, category: p.category, watts: p.watts, qty, hoursPerDay: p.hoursPerDay, inductive: p.inductive, surgeFactor: p.surgeFactor };
}

/** A typical Nigerian 3-bedroom home, used for the "start with a sample" option. */
export function sampleLoads(): LoadItem[] {
  const pick = (name: string, qty: number) => presetToLoad(APPLIANCE_PRESETS.find((p) => p.name === name)!, qty);
  return [
    pick("LED bulb", 12),
    pick("Security light (LED flood)", 2),
    pick("Ceiling fan", 4),
    pick("Refrigerator (medium)", 1),
    pick("LED TV 43\"", 2),
    pick("Decoder / set-top box", 1),
    pick("Laptop", 2),
    pick("Wi-Fi router", 1),
    pick("Phone charger", 4),
    pick("Water pump 0.5 HP", 1),
  ];
}
