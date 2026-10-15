import "server-only";
import { HttpError } from "./api";

/**
 * NIPOST Postcode API (https://docs.postcode.gov.ng). The secret key (NIPOST_API_KEY, scopes
 * `search` + `lookup`) stays on the server. Used: Lookup L1 (free validity check), reverse
 * geocode (free: coordinate → nearest building's postcode) and the free state/LGA reference lists.
 * NIPOST data is only relayed to the signed-in user for their own project; it is not resold,
 * redistributed or bulk-extracted (NIPOST Terms cl. 7.3, Acceptable Use Policy §3).
 */
const BASE = (process.env.NIPOST_API_BASE || "https://api.postcode.gov.ng").replace(/\/+$/, "");

export const nipostConfigured = () => Boolean(process.env.NIPOST_API_KEY);

async function call<T>(path: string, params: Record<string, string>, opts: { revalidate?: number } = {}): Promise<T> {
  const key = process.env.NIPOST_API_KEY;
  if (!key) throw new HttpError(503, "NIPOST verification is not set up on this server (NIPOST_API_KEY)");
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}?${new URLSearchParams(params)}`, {
      headers: { "X-API-Key": key, Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
      ...(opts.revalidate ? { next: { revalidate: opts.revalidate } } : { cache: "no-store" as const }),
    });
  } catch {
    throw new HttpError(504, "NIPOST did not respond. Check your connection and try again.");
  }
  const body = (await res.json().catch(() => ({}))) as { data?: T; error?: { code?: string; message?: string } };
  if (!res.ok) {
    const reason = body.error?.message || body.error?.code || `error ${res.status}`;
    if (res.status === 401 || res.status === 403) throw new HttpError(502, `NIPOST rejected this server's API key (${reason})`);
    if (res.status === 402) throw new HttpError(502, "The NIPOST account has run out of credits");
    if (res.status === 429) throw new HttpError(429, "NIPOST rate limit reached. Try again in a minute.");
    if (res.status === 400 || res.status === 404) throw new HttpError(400, `NIPOST: ${reason}`);
    throw new HttpError(502, `NIPOST returned an error (${reason})`);
  }
  if (!body.data) throw new HttpError(502, "Unexpected response from NIPOST");
  return body.data;
}

export interface NamedCode {
  code: string;
  name?: string;
}

/** Lookup level 1: is this a real, active postcode? (Free.) */
export async function lookupValid(code: string) {
  const data = await call<{ postcode?: string; valid?: boolean }>("/v1/lookup", { code, level: "1" });
  return data.valid === true;
}

export interface ReverseResult {
  found: boolean;
  postcode: string;
  distanceM: number;
  confidence: string;
  radiusM: number;
  /** Present only when the key has lookup level 2+. */
  stateName: string;
  lgaName: string;
  locality: string;
  address: string;
}

/** Coordinate → postcode of the nearest building within `maxDistanceM` (NIPOST clamps to 250 m). Free. */
export async function reverse(lat: number, lng: number, maxDistanceM = 50): Promise<ReverseResult> {
  const d = await call<{
    found?: boolean;
    radius_m?: number;
    unit?: { postcode?: string; distance_m?: number; confidence?: string; state_name?: string; lga_name?: string; locality_name?: string; address?: string };
  }>("/v1/search/reverse", { lat: String(lat), lng: String(lng), max_distance_m: String(maxDistanceM) });
  const u = d.found ? d.unit : undefined;
  return {
    found: Boolean(u?.postcode),
    postcode: u?.postcode ?? "",
    distanceM: Math.round(u?.distance_m ?? 0),
    confidence: u?.confidence ?? "",
    radiusM: d.radius_m ?? maxDistanceM,
    stateName: u?.state_name ?? "",
    lgaName: u?.lga_name ?? "",
    locality: u?.locality_name ?? "",
    address: u?.address ?? "",
  };
}

// The reference catalogues change rarely: cache them for a day.
const DAY = 60 * 60 * 24;

export async function stateName(code: string) {
  const d = await call<{ states?: NamedCode[] }>("/v1/reference/states", {}, { revalidate: DAY });
  return d.states?.find((s) => s.code === code)?.name ?? "";
}

export async function lgaName(state: string, lga: string) {
  const d = await call<{ lgas?: NamedCode[] }>("/v1/reference/lgas", { state }, { revalidate: DAY });
  return d.lgas?.find((l) => l.code === lga)?.name ?? "";
}
