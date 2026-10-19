import "server-only";
import { SITE_URL } from "@/lib/seo";

/**
 * Place name → approximate centre, only to open the map near the site (e.g. on the postcode's LGA),
 * and coordinates → state / LGA names to fill in the site's administrative area.
 * Uses OpenStreetMap Nominatim within its usage policy: identified user agent, at most one request
 * per second from this server, results cached. https://operations.osmfoundation.org/policies/nominatim/
 */
let last = 0;
const cache = new Map<string, { lat: number; lon: number } | null>();
const placeCache = new Map<string, PlaceNames | null>();

async function nominatim(path: string, params: Record<string, string>) {
  const wait = last + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
  const res = await fetch(`https://nominatim.openstreetmap.org/${path}?${new URLSearchParams({ format: "jsonv2", ...params })}`, {
    headers: { "User-Agent": `TmtechSolarPro/1.0 (+${SITE_URL})`, Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
    next: { revalidate: 60 * 60 * 24 * 30 },
  });
  return res.ok ? res.json() : null;
}

export async function geocodePlace(query: string): Promise<{ lat: number; lon: number } | null> {
  const key = query.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key)!;
  try {
    const rows = (await nominatim("search", { q: query, countrycodes: "ng", limit: "1" })) as { lat?: string; lon?: string }[] | null;
    if (!rows) return null;
    const hit = rows[0] ? { lat: Number(rows[0].lat), lon: Number(rows[0].lon) } : null;
    const out = hit && Number.isFinite(hit.lat) && Number.isFinite(hit.lon) ? hit : null;
    if (cache.size > 2000) cache.clear();
    cache.set(key, out);
    return out;
  } catch {
    return null;
  }
}

export interface PlaceNames {
  /** As OpenStreetMap names them, e.g. "Lagos State", "Eti Osa"; matched to our lists by the caller. */
  state: string;
  lga: string;
  locality: string;
}

/** Coordinates → state, LGA (OSM admin level 6, returned as "county") and town. */
export async function reversePlace(lat: number, lon: number): Promise<PlaceNames | null> {
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`; // ≈ 10 m: plenty for an LGA
  if (placeCache.has(key)) return placeCache.get(key)!;
  try {
    const row = (await nominatim("reverse", { lat: String(lat), lon: String(lon), zoom: "14", addressdetails: "1" })) as { address?: Record<string, string> } | null;
    if (!row) return null;
    const a = row.address ?? {};
    const out = a.state ? { state: a.state, lga: a.county ?? a.state_district ?? "", locality: a.city ?? a.town ?? a.village ?? a.suburb ?? "" } : null;
    if (placeCache.size > 2000) placeCache.clear();
    placeCache.set(key, out);
    return out;
  } catch {
    return null;
  }
}
