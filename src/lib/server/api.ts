import "server-only";
import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "./db";
import { getSession, type Session } from "./auth";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

/** Wraps a route handler: connects to MongoDB, resolves the session and maps errors to JSON. */
export function handler<C>(fn: (req: Request, ctx: C, session: Session) => Promise<Response>, opts: { auth?: boolean } = { auth: true }) {
  return async (req: Request, ctx: C) => {
    try {
      await connectDB();
      const session = await getSession();
      if (opts.auth !== false && !session) throw new HttpError(401, "Not signed in");
      return await fn(req, ctx, session as Session);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error(e);
      const msg = e instanceof Error && /MONGODB_URI|ECONNREFUSED|Server selection/i.test(e.message) ? "Database unavailable: check MONGODB_URI" : "Internal server error";
      return json({ error: msg }, 500);
    }
  };
}

export function assertId(id: string) {
  if (!isValidObjectId(id)) throw new HttpError(404, "Not found");
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}
