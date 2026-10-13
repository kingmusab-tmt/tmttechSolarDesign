import "server-only";
import { HttpError } from "./api";

/**
 * Fixed-window, in-memory rate limiter. Sufficient for a single server instance; for multiple
 * instances, back it with a shared store (e.g. a MongoDB TTL collection or Redis).
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  if (buckets.size > 10000) for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  b.count++;
  if (b.count > limit) {
    const mins = Math.ceil((b.resetAt - now) / 60000);
    throw new HttpError(429, `Too many attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`);
  }
}
