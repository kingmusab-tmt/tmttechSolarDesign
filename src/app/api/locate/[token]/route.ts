import { z } from "zod";
import { canonicalPostcode, inNigeria, round6 } from "@/lib/postcode";
import { HttpError, handler, json, readJson } from "@/lib/server/api";
import { hashToken, isTokenShape } from "@/lib/server/location-requests";
import { nipostConfigured, reverse } from "@/lib/server/nipost";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";
import { LocationRequest, type LocationRequestDoc } from "@/models/LocationRequest";
import { User } from "@/models/User";

type Ctx = { params: Promise<{ token: string }> };

/*
 * Public endpoints behind a client's location link. They reveal only who is asking (engineer name
 * and company), never the project or client details, and accept nothing but a location answer.
 */

async function openRequest(token: string) {
  if (!isTokenShape(token)) throw new HttpError(404, "This link is not valid");
  const r = await LocationRequest.findOne({ tokenHash: hashToken(token) }).lean<LocationRequestDoc>();
  if (!r || r.status === "closed" || r.expiresAt <= new Date()) throw new HttpError(410, "This link has expired or was replaced. Ask your installer for a new one.");
  return r;
}

export const GET = handler<Ctx>(
  async (req, ctx) => {
    rateLimit(`locate-get:${clientIp(req)}`, 60, 10 * 60_000);
    const { token } = await ctx.params;
    const r = await openRequest(token);
    const engineer = await User.findById(r.createdBy, { name: 1, company: 1 }).lean();
    return json({ status: r.status, engineerName: engineer?.name ?? "", company: engineer?.company ?? "", expiresAt: r.expiresAt });
  },
  { auth: false },
);

const Body = z.object({
  lat: z.number().finite(),
  lng: z.number().finite(),
  accuracyM: z.number().finite().min(0).max(100000).default(0),
  source: z.enum(["gps", "map"]),
  postcode: z.string().max(30).default(""),
  note: z.string().max(300).default(""),
});

export const POST = handler<Ctx>(
  async (req, ctx) => {
    rateLimit(`locate-post:${clientIp(req)}`, 15, 10 * 60_000);
    const { token } = await ctx.params;
    const r = await openRequest(token);
    const parsed = Body.safeParse(await readJson(req));
    if (!parsed.success) throw new HttpError(400, "Invalid location");
    const b = parsed.data;
    if (!inNigeria(b.lat, b.lng)) throw new HttpError(400, "That location is outside Nigeria. Move the pin onto your building.");
    const postcode = b.postcode.trim() ? canonicalPostcode(b.postcode) : "";
    if (b.postcode.trim() && !postcode) throw new HttpError(400, "That postcode is not in the NIPOST format (e.g. FC-02-A09-DB-09). Check it or leave it empty.");

    // Which building NIPOST finds at the shared location; the engineer sees this before applying.
    let pin = { pinChecked: false, pinPostcode: "", pinDistanceM: 0, pinConfidence: "" };
    if (nipostConfigured()) {
      try {
        const rv = await reverse(b.lat, b.lng);
        pin = { pinChecked: true, pinPostcode: rv.postcode, pinDistanceM: rv.distanceM, pinConfidence: rv.confidence };
      } catch {
        // NIPOST unavailable: the engineer can re-check after applying.
      }
    }

    const result = { lat: round6(b.lat), lng: round6(b.lng), accuracyM: Math.round(b.accuracyM), source: b.source, postcode, note: b.note.trim(), ...pin, submittedAt: new Date() };
    await LocationRequest.updateOne({ _id: r._id }, { $set: { status: "submitted", result } });
    return json({ ok: true, pinPostcode: pin.pinPostcode, pinChecked: pin.pinChecked });
  },
  { auth: false },
);
