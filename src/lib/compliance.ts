export interface ComplianceItem {
  key: string;
  group: string;
  standard: string;
  label: string;
  /** Optional ID of an engine check that verifies this item automatically. */
  autoCheck?: string;
}

export const COMPLIANCE_ITEMS: ComplianceItem[] = [
  // Equipment certification
  { key: "mod-cert", group: "Equipment certification", standard: "IEC 61215 / IEC 61730", label: "PV modules certified for design qualification and safety" },
  { key: "inv-cert", group: "Equipment certification", standard: "IEC 62109-1/-2", label: "Inverter / charge controller safety certification" },
  { key: "bat-cert", group: "Equipment certification", standard: "IEC 62619 / IEC 61427", label: "Battery safety and performance certification" },
  { key: "son", group: "Equipment certification", standard: "SON / SONCAP", label: "Products carry SONCAP / MANCAP conformity (Standards Organisation of Nigeria)" },
  { key: "cable-cert", group: "Equipment certification", standard: "EN 50618 / IEC 62930", label: "DC cables are solar-rated (UV, double-insulated, 1–1.5 kV DC)" },

  // Electrical design
  { key: "string-voltage", group: "Electrical design", standard: "IEC 62548", label: "Cold string Voc below the inverter maximum DC voltage", autoCheck: "str-voc" },
  { key: "cable-drop", group: "Electrical design", standard: "IEC 60364-5-52", label: "Cable voltage drop ≤ 3 % and Iz ≥ In on every circuit", autoCheck: "cab-*" },
  { key: "string-fuse", group: "Electrical design", standard: "IEC 60364-7-712", label: "String overcurrent protection where ≥ 3 strings are in parallel" },
  { key: "dc-isolation", group: "Electrical design", standard: "IEC 60364-7-712", label: "DC isolator on the PV side, rated for the cold Voc and the current" },
  { key: "battery-protection", group: "Electrical design", standard: "IEC 62485-2", label: "Battery fuse and isolator close to the battery terminals; ventilated battery room" },
  { key: "ac-protection", group: "Electrical design", standard: "IEC 60364-4-41", label: "AC output MCB and RCD (30 mA) protection for final circuits" },

  // Earthing & lightning
  { key: "earthing", group: "Earthing & lightning protection", standard: "IEC 60364-5-54", label: "Earth electrode installed and resistance ≤ 10 Ω", autoCheck: "as-earth" },
  { key: "bonding", group: "Earthing & lightning protection", standard: "IEC 60364-7-712", label: "Module frames and rails bonded with ≥ 6 mm² Cu" },
  { key: "dc-spd", group: "Earthing & lightning protection", standard: "IEC 61643-31", label: "Type II DC SPD at the inverter PV input", autoCheck: "cab-spd" },
  { key: "ac-spd", group: "Earthing & lightning protection", standard: "IEC 61643-11", label: "Type II AC SPD at the distribution board" },
  { key: "cable-routes", group: "Earthing & lightning protection", standard: "IEC 62548", label: "Cable routes minimise loop area; UV-protected; no sharp edges" },

  // Commissioning (IEC 62446-1)
  { key: "c-continuity", group: "Commissioning (IEC 62446-1)", standard: "IEC 62446-1", label: "Continuity of protective earthing and bonding conductors" },
  { key: "c-polarity", group: "Commissioning (IEC 62446-1)", standard: "IEC 62446-1", label: "Polarity test of every string" },
  { key: "c-voc", group: "Commissioning (IEC 62446-1)", standard: "IEC 62446-1", label: "String open-circuit voltage (Voc) measured and recorded" },
  { key: "c-isc", group: "Commissioning (IEC 62446-1)", standard: "IEC 62446-1", label: "String short-circuit / operating current measured" },
  { key: "c-insulation", group: "Commissioning (IEC 62446-1)", standard: "IEC 62446-1", label: "Insulation resistance test of the DC circuits" },
  { key: "c-functional", group: "Commissioning (IEC 62446-1)", standard: "IEC 62446-1", label: "Functional tests: switchgear, inverter, changeover" },
  { key: "c-docs", group: "Commissioning (IEC 62446-1)", standard: "IEC 62446-1", label: "System documentation handed over (datasheets, SLD, test reports, O&M manual)" },

  // Regulatory
  { key: "nemsa", group: "Regulatory (Nigeria)", standard: "NEMSA", label: "Installation inspected and certified by NEMSA where required" },
  { key: "coren", group: "Regulatory (Nigeria)", standard: "COREN", label: "Design reviewed and signed by a COREN-registered engineer" },
  { key: "structural", group: "Regulatory (Nigeria)", standard: "NBC / structural", label: "Roof structure verified for the array dead load and wind uplift", autoCheck: "as-structure" },
  { key: "labels", group: "Regulatory (Nigeria)", standard: "IEC 60364-7-712", label: "Warning labels on the DC junction boxes, isolators and DB (dual supply)" },
];

export const COMPLIANCE_GROUPS = [...new Set(COMPLIANCE_ITEMS.map((i) => i.group))];
