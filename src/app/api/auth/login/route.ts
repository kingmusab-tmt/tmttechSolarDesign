import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSessionToken, setSessionCookie } from "@/lib/server/auth";
import { HttpError, handler, readJson } from "@/lib/server/api";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";
import { isBootstrapAdmin } from "@/lib/server/access";
import { User } from "@/models/User";

const Body = z.object({ email: z.string().trim().max(200), password: z.string().max(200) });

export const POST = handler(
  async (req) => {
    const parsed = Body.safeParse(await readJson(req));
    if (!parsed.success) throw new HttpError(400, "Email and password are required");
    // Brute-force protection: per IP and per account.
    rateLimit(`login-ip:${clientIp(req)}`, 30, 15 * 60_000);
    rateLimit(`login-email:${parsed.data.email.toLowerCase()}`, 8, 15 * 60_000);
    const user = await User.findOne({ email: parsed.data.email.toLowerCase() });
    if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) throw new HttpError(401, "Invalid email or password");
    if (user.role !== "admin" && isBootstrapAdmin(user.email)) await User.updateOne({ _id: user._id }, { $set: { role: "admin" } });
    const res = NextResponse.json({ user: { id: String(user._id), name: user.name, email: user.email } });
    setSessionCookie(res, await createSessionToken({ userId: String(user._id), email: user.email, name: user.name }));
    return res;
  },
  { auth: false },
);
