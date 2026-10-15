/**
 * NIPOST digital postcodes: 5 segments, e.g. FC-02-A09-DB-09
 *   state (2 letters) · LGA (2 digits) · district (3 alphanumeric) · area (2 letters) · building unit (2 digits).
 * Input may be hyphenated, spaced or compact, in any case.
 * https://docs.postcode.gov.ng/concepts/postcode-format
 */
export interface PostcodeParts {
  state: string;
  lga: string;
  district: string;
  area: string;
  unit: string;
  /** Hyphenated canonical form: FC-02-A09-DB-09 */
  formatted: string;
  /** Compact form: FC02A09DB09 */
  compact: string;
}

const PATTERN = /^([A-Z]{2})(\d{2})([A-Z0-9]{3})([A-Z]{2})(\d{2})$/;

export function parsePostcode(input: string): PostcodeParts | null {
  const compact = input.toUpperCase().replace(/[\s-]+/g, "");
  const m = PATTERN.exec(compact);
  if (!m) return null;
  const [, state, lga, district, area, unit] = m;
  if (lga === "00" || unit === "00") return null; // both are zero-filled 01–99
  return { state, lga, district, area, unit, formatted: `${state}-${lga}-${district}-${area}-${unit}`, compact };
}

/** Canonical form for comparison and storage, or "" when the input is not a postcode. */
export function canonicalPostcode(input: string) {
  return parsePostcode(input)?.formatted ?? "";
}

/** How the site coordinates were obtained (NIPOST method). */
export const LOCATION_SOURCES = ["", "gps", "map", "client", "manual"] as const;
export type LocationSource = (typeof LOCATION_SOURCES)[number];

export const LOCATION_SOURCE_LABELS: Record<LocationSource, string> = {
  "": "not set",
  gps: "device GPS on site",
  map: "pin on the satellite map",
  client: "shared by the client",
  manual: "entered manually",
};

export type PinMatch = "matched" | "mismatch" | "no_building" | "unchecked";

/** Compare the postcode the engineer entered with the one NIPOST resolved for the pinned location. */
export function pinMatch(postcode: string, pinPostcode: string, pinChecked: boolean): PinMatch {
  if (!pinChecked) return "unchecked";
  if (!pinPostcode) return "no_building";
  return canonicalPostcode(postcode) && canonicalPostcode(postcode) === canonicalPostcode(pinPostcode) ? "matched" : "mismatch";
}

/** Great-circle distance in metres. */
export function distanceM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Coordinates are stored to 6 decimals (≈ 0.1 m), well beyond GPS accuracy. */
export const round6 = (v: number) => Math.round(v * 1e6) / 1e6;

/** Nigeria's bounding box with a small margin: pins outside it are almost certainly mistakes. */
export function inNigeria(lat: number, lon: number) {
  return lat >= 3.8 && lat <= 14.2 && lon >= 2.5 && lon <= 15;
}

/** One-line statement of the site's postcode and how its location was verified (reports). */
export function nipostLine(site: { nipost: { postcode: string; validity: string; source: LocationSource; accuracyM: number; pinChecked: boolean; pinPostcode: string; pinDistanceM: number } }) {
  const n = site.nipost;
  const match = pinMatch(n.postcode, n.pinPostcode, n.pinChecked);
  const verified =
    match === "matched"
      ? `location verified by NIPOST (pin ${n.pinDistanceM} m from the building's NIPOST point)`
      : match === "mismatch"
        ? `location NOT matched: NIPOST places the pin on ${n.pinPostcode}`
        : match === "no_building"
          ? "no NIPOST building found at the pinned location"
          : n.validity === "valid"
            ? "postcode confirmed by NIPOST; location not cross-checked"
            : "not verified with NIPOST";
  const how = n.source ? `; coordinates from ${LOCATION_SOURCE_LABELS[n.source]}${n.accuracyM ? ` (±${n.accuracyM} m)` : ""}` : "";
  return `${n.postcode}: ${verified}${how}`;
}
