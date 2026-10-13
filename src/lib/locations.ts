/**
 * Indicative design climate data for major Nigerian cities.
 * peakSunHours: annual average (kWh/m²/day on a horizontal plane).
 * tMin / tMax: record-low and record-high ambient temperatures (°C), used for string sizing.
 * Verify against PVGIS / NASA POWER and local meteorological records for final designs.
 */
export interface LocationPreset {
  key: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  peakSunHours: number;
  tMin: number;
  tMax: number;
}

export const LOCATIONS: LocationPreset[] = [
  { key: "lagos", city: "Lagos", state: "Lagos", latitude: 6.52, longitude: 3.38, peakSunHours: 4.5, tMin: 18, tMax: 35 },
  { key: "abuja", city: "Abuja", state: "FCT", latitude: 9.06, longitude: 7.49, peakSunHours: 5.4, tMin: 11, tMax: 39 },
  { key: "kano", city: "Kano", state: "Kano", latitude: 12.0, longitude: 8.52, peakSunHours: 6.0, tMin: 7, tMax: 43 },
  { key: "kaduna", city: "Kaduna", state: "Kaduna", latitude: 10.52, longitude: 7.44, peakSunHours: 5.7, tMin: 8, tMax: 40 },
  { key: "port_harcourt", city: "Port Harcourt", state: "Rivers", latitude: 4.82, longitude: 7.03, peakSunHours: 4.2, tMin: 18, tMax: 35 },
  { key: "ibadan", city: "Ibadan", state: "Oyo", latitude: 7.38, longitude: 3.95, peakSunHours: 4.8, tMin: 15, tMax: 37 },
  { key: "enugu", city: "Enugu", state: "Enugu", latitude: 6.45, longitude: 7.51, peakSunHours: 4.8, tMin: 14, tMax: 37 },
  { key: "benin", city: "Benin City", state: "Edo", latitude: 6.34, longitude: 5.63, peakSunHours: 4.4, tMin: 16, tMax: 36 },
  { key: "jos", city: "Jos", state: "Plateau", latitude: 9.9, longitude: 8.86, peakSunHours: 5.6, tMin: 4, tMax: 35 },
  { key: "ilorin", city: "Ilorin", state: "Kwara", latitude: 8.5, longitude: 4.55, peakSunHours: 5.2, tMin: 12, tMax: 39 },
  { key: "maiduguri", city: "Maiduguri", state: "Borno", latitude: 11.85, longitude: 13.16, peakSunHours: 6.2, tMin: 5, tMax: 46 },
  { key: "sokoto", city: "Sokoto", state: "Sokoto", latitude: 13.06, longitude: 5.24, peakSunHours: 6.1, tMin: 8, tMax: 46 },
  { key: "owerri", city: "Owerri", state: "Imo", latitude: 5.48, longitude: 7.03, peakSunHours: 4.4, tMin: 17, tMax: 35 },
  { key: "calabar", city: "Calabar", state: "Cross River", latitude: 4.95, longitude: 8.32, peakSunHours: 4.1, tMin: 18, tMax: 34 },
  { key: "abeokuta", city: "Abeokuta", state: "Ogun", latitude: 7.15, longitude: 3.35, peakSunHours: 4.7, tMin: 15, tMax: 37 },
  { key: "yola", city: "Yola", state: "Adamawa", latitude: 9.2, longitude: 12.48, peakSunHours: 5.9, tMin: 10, tMax: 45 },
];

export function findLocation(key: string) {
  return LOCATIONS.find((l) => l.key === key);
}
