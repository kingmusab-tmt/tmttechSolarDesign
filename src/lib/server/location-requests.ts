import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { SITE_URL } from "@/lib/seo";
import type { LocationRequestDoc } from "@/models/LocationRequest";

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const newToken = () => randomBytes(24).toString("base64url");
export const isTokenShape = (token: string) => /^[A-Za-z0-9_-]{32}$/.test(token);

/** Absolute link for the client; falls back to the request's own origin in development. */
export function locateLink(req: Request, token: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL ? SITE_URL : new URL(req.url).origin;
  return `${base}/locate/${token}`;
}

/** What the engineer sees about a request (never the token). */
export function publicRequest(r: LocationRequestDoc) {
  return {
    id: String(r._id),
    status: r.status,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
    result: r.result ? { ...r.result, submittedAt: r.result.submittedAt } : null,
  };
}
