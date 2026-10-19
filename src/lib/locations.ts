import { LGAS } from "./lgas";
import { distanceM } from "./postcode";

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

export function nearestPreset(lat: number, lng: number) {
  return LOCATIONS.reduce((best, l) => (distanceM(lat, lng, l.latitude, l.longitude) < distanceM(lat, lng, best.latitude, best.longitude) ? l : best));
}

/** The 36 states and the FCT, with the capital's coordinates as the starting point for a new project. */
export interface NigerianState {
  name: string;
  capital: string;
  latitude: number;
  longitude: number;
  /** City preset in this state, when one exists. */
  presetKey?: string;
}

export const NIGERIAN_STATES: NigerianState[] = [
  { name: "Abia", capital: "Umuahia", latitude: 5.53, longitude: 7.49 },
  { name: "Adamawa", capital: "Yola", latitude: 9.2, longitude: 12.48, presetKey: "yola" },
  { name: "Akwa Ibom", capital: "Uyo", latitude: 5.04, longitude: 7.91 },
  { name: "Anambra", capital: "Awka", latitude: 6.21, longitude: 7.07 },
  { name: "Bauchi", capital: "Bauchi", latitude: 10.31, longitude: 9.84 },
  { name: "Bayelsa", capital: "Yenagoa", latitude: 4.92, longitude: 6.26 },
  { name: "Benue", capital: "Makurdi", latitude: 7.73, longitude: 8.54 },
  { name: "Borno", capital: "Maiduguri", latitude: 11.85, longitude: 13.16, presetKey: "maiduguri" },
  { name: "Cross River", capital: "Calabar", latitude: 4.95, longitude: 8.32, presetKey: "calabar" },
  { name: "Delta", capital: "Asaba", latitude: 6.2, longitude: 6.73 },
  { name: "Ebonyi", capital: "Abakaliki", latitude: 6.32, longitude: 8.11 },
  { name: "Edo", capital: "Benin City", latitude: 6.34, longitude: 5.63, presetKey: "benin" },
  { name: "Ekiti", capital: "Ado-Ekiti", latitude: 7.62, longitude: 5.22 },
  { name: "Enugu", capital: "Enugu", latitude: 6.45, longitude: 7.51, presetKey: "enugu" },
  { name: "FCT", capital: "Abuja", latitude: 9.06, longitude: 7.49, presetKey: "abuja" },
  { name: "Gombe", capital: "Gombe", latitude: 10.29, longitude: 11.17 },
  { name: "Imo", capital: "Owerri", latitude: 5.48, longitude: 7.03, presetKey: "owerri" },
  { name: "Jigawa", capital: "Dutse", latitude: 11.76, longitude: 9.34 },
  { name: "Kaduna", capital: "Kaduna", latitude: 10.52, longitude: 7.44, presetKey: "kaduna" },
  { name: "Kano", capital: "Kano", latitude: 12.0, longitude: 8.52, presetKey: "kano" },
  { name: "Katsina", capital: "Katsina", latitude: 12.99, longitude: 7.6 },
  { name: "Kebbi", capital: "Birnin Kebbi", latitude: 12.45, longitude: 4.2 },
  { name: "Kogi", capital: "Lokoja", latitude: 7.8, longitude: 6.74 },
  { name: "Kwara", capital: "Ilorin", latitude: 8.5, longitude: 4.55, presetKey: "ilorin" },
  { name: "Lagos", capital: "Ikeja", latitude: 6.6, longitude: 3.35, presetKey: "lagos" },
  { name: "Nasarawa", capital: "Lafia", latitude: 8.49, longitude: 8.52 },
  { name: "Niger", capital: "Minna", latitude: 9.61, longitude: 6.56 },
  { name: "Ogun", capital: "Abeokuta", latitude: 7.15, longitude: 3.35, presetKey: "abeokuta" },
  { name: "Ondo", capital: "Akure", latitude: 7.25, longitude: 5.19 },
  { name: "Osun", capital: "Osogbo", latitude: 7.77, longitude: 4.56 },
  { name: "Oyo", capital: "Ibadan", latitude: 7.38, longitude: 3.95, presetKey: "ibadan" },
  { name: "Plateau", capital: "Jos", latitude: 9.9, longitude: 8.86, presetKey: "jos" },
  { name: "Rivers", capital: "Port Harcourt", latitude: 4.82, longitude: 7.03, presetKey: "port_harcourt" },
  { name: "Sokoto", capital: "Sokoto", latitude: 13.06, longitude: 5.24, presetKey: "sokoto" },
  { name: "Taraba", capital: "Jalingo", latitude: 8.89, longitude: 11.36 },
  { name: "Yobe", capital: "Damaturu", latitude: 11.75, longitude: 11.96 },
  { name: "Zamfara", capital: "Gusau", latitude: 12.16, longitude: 6.66 },
];

export function findState(name: string) {
  return NIGERIAN_STATES.find((s) => s.name === name);
}

export function lgasOf(state: string): string[] {
  return LGAS[state] ?? [];
}

const norm = (v: string) =>
  v
    .toLowerCase()
    .replace(/\b(state|local government area|local government|lga)\b/g, "")
    .replace(/[^a-z0-9]/g, "");

const STATE_ALIASES: Record<string, string> = { federalcapitalterritory: "FCT", abuja: "FCT", nassarawa: "Nasarawa" };
const LGA_ALIASES: Record<string, string> = { egbadonorth: "Yewa North", egbadosouth: "Yewa South", somolu: "Shomolu", sagamu: "Shagamu", amac: "Municipal Area Council" };

/** Our state name for a name from NIPOST or OpenStreetMap ("Lagos State", "Federal Capital Territory"), or "" when unknown. */
export function matchState(name: string) {
  const n = norm(name);
  if (!n) return "";
  return STATE_ALIASES[n] ?? NIGERIAN_STATES.find((s) => norm(s.name) === n)?.name ?? "";
}

/** Our LGA name for an outside name within a state, or the name as given when it is not in the list. */
export function matchLga(state: string, name: string) {
  const n = norm(name);
  if (!n) return "";
  const list = lgasOf(state);
  const alias = LGA_ALIASES[n];
  if (alias && list.includes(alias)) return alias;
  const exact = list.find((l) => norm(l) === n);
  if (exact) return exact;
  // "Abuja Municipal Area Council" ⊃ "Municipal Area Council", "Ifako" ⊂ "Ifako-Ijaiye": take the longest overlap.
  const partial = list.filter((l) => n.includes(norm(l)) || norm(l).includes(n)).sort((a, b) => b.length - a.length)[0];
  return partial ?? name.trim();
}

/**
 * Starting site for a new project in a state: the state's city preset if there is one, otherwise the
 * capital's coordinates with provisional climate from the nearest preset (refined later in Project & Site).
 */
export function siteForState(st: NigerianState) {
  const preset = st.presetKey ? findLocation(st.presetKey) : undefined;
  if (preset) {
    const { key, ...rest } = preset;
    return { locationPreset: key, ...rest, climateSource: "Location preset" };
  }
  const near = nearestPreset(st.latitude, st.longitude);
  return {
    locationPreset: "custom",
    city: st.capital,
    state: st.name,
    latitude: st.latitude,
    longitude: st.longitude,
    peakSunHours: near.peakSunHours,
    tMin: near.tMin,
    tMax: near.tMax,
    climateSource: `Location preset (nearest city: ${near.city})`,
  };
}
