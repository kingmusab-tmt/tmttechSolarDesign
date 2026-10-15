import "server-only";
import { SITE_URL } from "@/lib/seo";

/**
 * Place name → approximate centre, only to open the map near the site (e.g. on the postcode's LGA).
 * Uses OpenStreetMap Nominatim within its usage policy: identified user agent, at most one request
 * per second from this server, results cached. https://operations.osmfoundation.org/policies/nominatim/
 */
let last = 0;
const cache = new Map<string, { lat: number; lon: number } | null>();

export async function geocodePlace(query: string): Promise<{ lat: number; lon: number } | null> {
  const key = query.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key)!;
  const wait = last + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
  const q = new URLSearchParams({ q: query, countrycodes: "ng", format: "jsonv2", limit: "1" });
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${q}`, {
      headers: { "User-Agent": `TmtechSolarPro/1.0 (+${SITE_URL})`, Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
      next: { revalidate: 60 * 60 * 24 * 30 },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as { lat?: string; lon?: string }[];
    const hit = rows[0] ? { lat: Number(rows[0].lat), lon: Number(rows[0].lon) } : null;
    const out = hit && Number.isFinite(hit.lat) && Number.isFinite(hit.lon) ? hit : null;
    if (cache.size > 2000) cache.clear();
    cache.set(key, out);
    return out;
  } catch {
    return null;
  }
}
