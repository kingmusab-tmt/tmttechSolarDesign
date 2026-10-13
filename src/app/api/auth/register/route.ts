import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSessionToken, setSessionCookie } from "@/lib/server/auth";
import { HttpError, handler, readJson } from "@/lib/server/api";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";
import { isBootstrapAdmin } from "@/lib/server/access";
import { User } from "@/models/User";

const Body = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().max(200),
  password: z.string().min(8).max(200),
  company: z.string().max(200).optional().default(""),
});

export const POST = handler(
  async (req) => {
    rateLimit(`register:${clientIp(req)}`, 10, 60 * 60_000);
    const parsed = Body.safeParse(await readJson(req));
    if (!parsed.success) throw new HttpError(400, "Enter your name, a valid email and a password of at least 8 characters");
    const { name, email, password, company } = parsed.data;
    const lower = email.toLowerCase();
    if (await User.exists({ email: lower })) throw new HttpError(409, "An account with this email already exists");
    const user = await User.create({ name, email: lower, company, passwordHash: await bcrypt.hash(password, 10), role: isBootstrapAdmin(lower) ? "admin" : "user" });
    const res = NextResponse.json({ user: { id: String(user._id), name, email: lower } }, { status: 201 });
    setSessionCookie(res, await createSessionToken({ userId: String(user._id), email: lower, name }));
    return res;
  },
  { auth: false },
);
