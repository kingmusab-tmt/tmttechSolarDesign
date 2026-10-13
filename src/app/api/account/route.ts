import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSessionToken, setSessionCookie } from "@/lib/server/auth";
import { HttpError, handler, json, readJson } from "@/lib/server/api";
import { rateLimit } from "@/lib/server/rate-limit";
import { User } from "@/models/User";

export const GET = handler(async (_req, _ctx, session) => {
  const user = await User.findById(session.userId).lean();
  if (!user) throw new HttpError(404, "Account not found");
  return json({ user: { name: user.name, email: user.email, company: user.company ?? "" } });
});

const Body = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  company: z.string().trim().max(200).optional(),
  currentPassword: z.string().max(200).optional(),
  newPassword: z.string().min(8).max(200).optional(),
});

export const PATCH = handler(async (req, _ctx, session) => {
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(400, "Name must be at least 2 characters and new passwords at least 8");
  const { name, company, currentPassword, newPassword } = parsed.data;
  const user = await User.findById(session.userId);
  if (!user) throw new HttpError(404, "Account not found");

  if (newPassword) {
    rateLimit(`pwchange:${session.userId}`, 5, 15 * 60_000);
    if (!currentPassword || !(await bcrypt.compare(currentPassword, user.passwordHash))) throw new HttpError(403, "Current password is incorrect");
    user.passwordHash = await bcrypt.hash(newPassword, 10);
  }
  if (name !== undefined) user.name = name;
  if (company !== undefined) user.company = company;
  await user.save();

  // Refresh the session so the new name shows immediately.
  const res = NextResponse.json({ ok: true, passwordChanged: Boolean(newPassword) });
  setSessionCookie(res, await createSessionToken({ userId: String(user._id), email: user.email, name: user.name }));
  return res;
});
