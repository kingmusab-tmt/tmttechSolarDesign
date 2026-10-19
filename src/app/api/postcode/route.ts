import { inNigeria, parsePostcode } from "@/lib/postcode";
import { HttpError, handler, json } from "@/lib/server/api";
import { matchLga, matchState } from "@/lib/locations";
import { geocodePlace, reversePlace } from "@/lib/server/geocode";
import { lgaName, lookupValid, nipostConfigured, reverse, stateName } from "@/lib/server/nipost";
import { rateLimit } from "@/lib/server/rate-limit";

/**
 * NIPOST postcode helpers for the Project & Site step (signed-in users only).
 *   ?action=validate&code=FC-02-A09-DB-09   format + NIPOST Lookup L1 + state/LGA names
 *   ?action=reverse&lat=..&lng=..           the building NIPOST finds at a pinned location
 *   ?action=centre&q=Bwari, FCT             approximate map centre for a place name
 *   ?action=place&lat=..&lng=..             state and LGA at a location (OpenStreetMap), matched to our lists
 */
export const GET = handler(async (req, _ctx, session) => {
  rateLimit(`postcode:${session.userId}`, 60, 60_000);
  const sp = new URL(req.url).searchParams;
  const action = sp.get("action");

  if (action === "validate") {
    const p = parsePostcode(sp.get("code") ?? "");
    if (!p) throw new HttpError(400, "Not a NIPOST postcode. The format is state, LGA, district, area, building, e.g. FC-02-A09-DB-09");
    if (!nipostConfigured()) return json({ postcode: p.formatted, configured: false, valid: null, stateName: "", lgaName: "" });
    const [valid, sName, lName] = await Promise.all([lookupValid(p.formatted), stateName(p.state).catch(() => ""), lgaName(p.state, p.lga).catch(() => "")]);
    return json({ postcode: p.formatted, configured: true, valid, stateName: sName, lgaName: lName });
  }

  if (action === "reverse") {
    const lat = Number(sp.get("lat"));
    const lng = Number(sp.get("lng"));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new HttpError(400, "Valid coordinates are required");
    if (!inNigeria(lat, lng)) throw new HttpError(400, "That location is outside Nigeria");
    if (!nipostConfigured()) return json({ configured: false });
    return json({ configured: true, ...(await reverse(lat, lng)) });
  }

  if (action === "place") {
    const lat = Number(sp.get("lat"));
    const lng = Number(sp.get("lng"));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new HttpError(400, "Valid coordinates are required");
    if (!inNigeria(lat, lng)) throw new HttpError(400, "That location is outside Nigeria");
    const p = await reversePlace(lat, lng);
    const state = p ? matchState(p.state) : "";
    return json({ place: state && p ? { state, lga: matchLga(state, p.lga), locality: p.locality } : null });
  }

  if (action === "centre") {
    const q = (sp.get("q") ?? "").trim().slice(0, 120);
    if (!q) throw new HttpError(400, "A place name is required");
    return json({ centre: await geocodePlace(q) });
  }

  throw new HttpError(400, "Unknown action");
});
