import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/access";
import { HttpError, handler, json, readJson } from "@/lib/server/api";
import { User } from "@/models/User";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({ role: z.enum(["user", "admin"]) });

/** Promote or demote a user. The last remaining admin cannot be demoted. */
export const PATCH = handler<Ctx>(async (req, ctx, session) => {
  await requireAdmin(session);
  const { id } = await ctx.params;
  if (!isValidObjectId(id)) throw new HttpError(404, "User not found");
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(400, "Role must be user or admin");
  const user = await User.findById(id).lean();
  if (!user) throw new HttpError(404, "User not found");
  if (parsed.data.role === "user" && user.role === "admin" && (await User.countDocuments({ role: "admin" })) <= 1) {
    throw new HttpError(400, "There must always be at least one administrator");
  }
  await User.updateOne({ _id: user._id }, { $set: { role: parsed.data.role } });
  return json({ ok: true });
});
