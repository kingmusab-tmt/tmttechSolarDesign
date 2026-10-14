import { z } from "zod";
import { TOUR_IDS } from "@/lib/tours";
import { HttpError, handler, json, readJson } from "@/lib/server/api";
import { User } from "@/models/User";

/** Guided tours this user has finished or skipped, so they only start automatically once per account. */
export const GET = handler(async (_req, _ctx, session) => {
  const user = await User.findById(session.userId, { toursDone: 1 }).lean();
  return json({ done: user?.toursDone ?? [] });
});

const Body = z.object({ tour: z.enum(TOUR_IDS), done: z.boolean().default(true) });

export const POST = handler(async (req, _ctx, session) => {
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(400, "Unknown tour");
  const { tour, done } = parsed.data;
  await User.updateOne({ _id: session.userId }, done ? { $addToSet: { toursDone: tour } } : { $pull: { toursDone: tour } });
  return json({ ok: true });
});
