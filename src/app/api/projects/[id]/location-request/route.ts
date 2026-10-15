import { projectAccess } from "@/lib/server/access";
import { handler, json } from "@/lib/server/api";
import { hashToken, locateLink, newToken, publicRequest } from "@/lib/server/location-requests";
import { rateLimit } from "@/lib/server/rate-limit";
import { LOCATION_REQUEST_DAYS, LocationRequest, type LocationRequestDoc } from "@/models/LocationRequest";

type Ctx = { params: Promise<{ id: string }> };

/** The project's open location request (pending or answered), if any. */
export const GET = handler<Ctx>(async (_req, ctx, session) => {
  const { id } = await ctx.params;
  const { project } = await projectAccess(session.userId, id);
  const r = await LocationRequest.findOne({ project: project._id, status: { $ne: "closed" }, expiresAt: { $gt: new Date() } })
    .sort({ createdAt: -1 })
    .lean<LocationRequestDoc>();
  return json({ request: r ? publicRequest(r) : null });
});

/** Create a new link for the client. Any earlier open link for this project stops working. */
export const POST = handler<Ctx>(async (req, ctx, session) => {
  const { id } = await ctx.params;
  rateLimit(`locreq:${session.userId}`, 20, 60 * 60_000);
  const { project } = await projectAccess(session.userId, id);
  await LocationRequest.updateMany({ project: project._id, status: { $ne: "closed" } }, { $set: { status: "closed" } });
  const token = newToken();
  const r = await LocationRequest.create({
    tokenHash: hashToken(token),
    project: project._id,
    createdBy: session.userId,
    expiresAt: new Date(Date.now() + LOCATION_REQUEST_DAYS * 86400_000),
  });
  return json({ link: locateLink(req, token), request: publicRequest(r.toObject() as LocationRequestDoc) }, 201);
});

/** Close the open request (after applying the client's answer, or to cancel the link). */
export const DELETE = handler<Ctx>(async (_req, ctx, session) => {
  const { id } = await ctx.params;
  const { project } = await projectAccess(session.userId, id);
  await LocationRequest.updateMany({ project: project._id, status: { $ne: "closed" } }, { $set: { status: "closed" } });
  return json({ ok: true });
});
