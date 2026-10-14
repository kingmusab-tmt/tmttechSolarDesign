import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { handler } from "@/lib/server/api";
import { VISIT_RETENTION_DAYS, Visit, utcDay } from "@/models/Visit";

const COOKIE = "shs_vid";
const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|pingdom|monitor/i;

/** Counts a page view for the admin traffic figures. Anonymous: a random device id, no IP address. */
export const POST = handler(
  async (req, _ctx, session) => {
    const res = new NextResponse(null, { status: 204 });
    if (BOT.test(req.headers.get("user-agent") ?? "")) return res;

    let visitor = (await cookies()).get(COOKIE)?.value ?? "";
    if (!/^[a-f0-9-]{36}$/.test(visitor)) {
      visitor = crypto.randomUUID();
      res.cookies.set(COOKIE, visitor, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
    }
    const now = new Date();
    await Visit.updateOne(
      { day: utcDay(now), visitor },
      {
        $inc: { views: 1 },
        $set: { lastAt: now, ...(session ? { user: session.userId } : {}) },
        $setOnInsert: { expiresAt: new Date(now.getTime() + VISIT_RETENTION_DAYS * 86_400_000) },
      },
      { upsert: true },
    );
    return res;
  },
  { auth: false },
);
