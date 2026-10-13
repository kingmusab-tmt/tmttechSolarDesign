import { nasaPowerUrl, parseNasaPower } from "@/lib/climate";
import { HttpError, handler, json } from "@/lib/server/api";

/**
 * NASA POWER climatology for a site. NASA publishes this API for programmatic use.
 * (Global Solar Atlas values are entered by the engineer; its terms forbid automated access.)
 */
export const GET = handler(async (req) => {
  const sp = new URL(req.url).searchParams;
  const lat = Number(sp.get("lat"));
  const lon = Number(sp.get("lon"));
  if (!sp.get("lat") || !sp.get("lon") || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new HttpError(400, "Valid latitude and longitude are required");
  let res: Response;
  try {
    // Climatology changes rarely: cache each location for 30 days.
    res = await fetch(nasaPowerUrl(lat, lon), { signal: AbortSignal.timeout(20000), headers: { Accept: "application/json" }, next: { revalidate: 60 * 60 * 24 * 30 } });
  } catch {
    throw new HttpError(504, "NASA POWER did not respond. Check your connection and try again.");
  }
  if (!res.ok) throw new HttpError(502, `NASA POWER returned an error (${res.status})`);
  try {
    return json({ nasa: parseNasaPower(await res.json()) });
  } catch (e) {
    throw new HttpError(502, e instanceof Error ? e.message : "Could not read NASA POWER data");
  }
});
