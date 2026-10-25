/**
 * Rate limiting for login, account recovery and registration. Vercel functions don't share
 * memory, so counters live in Postgres (`rate_limits`): one row per key and fixed window,
 * incremented atomically. Each check counts the request, so a caller over the limit stays
 * blocked until the window ends.
 *
 * Bot protection is the honeypot field (`HONEYPOT_FIELD`): a hidden input people never fill.
 */
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import prisma from "./prisma";
import { HONEYPOT_FIELD } from "@/lib/honeypot";

export type Limit = { limit: number; windowSec: number };

/** The limits, in one place. */
export const LIMITS = {
  loginIp: { limit: 30, windowSec: 15 * 60 },
  loginEmail: { limit: 10, windowSec: 15 * 60 },
  recoveryIp: { limit: 10, windowSec: 60 * 60 }, // login link and password reset requests
  recoveryEmail: { limit: 5, windowSec: 60 * 60 },
  resetConfirmIp: { limit: 20, windowSec: 60 * 60 },
  retrieveIp: { limit: 20, windowSec: 60 * 60 },
  registerIp: { limit: 10, windowSec: 60 * 60 },
  discountIp: { limit: 30, windowSec: 10 * 60 },
} satisfies Record<string, Limit>;

export type RateResult = { ok: true } | { ok: false; retryAfterSec: number };

/** Counts one request for `key` and says whether it's within `limit` per window. */
export async function hit(key: string, { limit, windowSec }: Limit, at = new Date()): Promise<RateResult> {
  const windowMs = windowSec * 1000;
  const start = new Date(Math.floor(at.getTime() / windowMs) * windowMs);
  const [{ count }] = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO rate_limits ("key", "windowStart", "count") VALUES (${key}, ${start}, 1)
    ON CONFLICT ("key", "windowStart") DO UPDATE SET "count" = rate_limits."count" + 1
    RETURNING "count"`;
  if (count <= limit) return { ok: true };
  return { ok: false, retryAfterSec: Math.max(1, Math.ceil((start.getTime() + windowMs - at.getTime()) / 1000)) };
}

/** Checks several limits (e.g. per IP and per email); the first one over wins. */
export async function hitAll(checks: [key: string, limit: Limit][], at = new Date()): Promise<RateResult> {
  let blocked: RateResult = { ok: true };
  for (const [key, limit] of checks) {
    const r = await hit(key, limit, at);
    if (!r.ok && (blocked.ok || r.retryAfterSec > blocked.retryAfterSec)) blocked = r;
  }
  return blocked;
}

const ipFrom = (h: Headers) => h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || null;

/** The caller's IP: Vercel sets x-forwarded-for (first entry is the client); else the request context's. */
export async function clientIp(req?: { headers: Headers }): Promise<string> {
  const fromReq = req ? ipFrom(req.headers) : null;
  if (fromReq) return fromReq;
  try {
    return ipFrom(await headers()) ?? "unknown";
  } catch {
    return "unknown"; // not inside a request
  }
}

/** Keys are lowercased and length-capped (emails come from user input). */
export const rateKey = (scope: string, id: string) => `${scope}:${id.trim().toLowerCase().slice(0, 254)}`;

/** The 429 response for API routes. */
export function tooMany(r: Extract<RateResult, { ok: false }>, what = "requests") {
  const minutes = Math.ceil(r.retryAfterSec / 60);
  return NextResponse.json(
    { error: `Too many ${what}. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.` },
    { status: 429, headers: { "Retry-After": String(r.retryAfterSec) } },
  );
}

/** True when the hidden bot field (`useHoneypot`) came back filled in. */
export const honeypotFilled = (body: unknown) => {
  const v = body && typeof body === "object" ? (body as Record<string, unknown>)[HONEYPOT_FIELD] : undefined;
  return typeof v === "string" && v.trim() !== "";
};

/** Deletes windows older than a day (daily cron). */
export async function pruneRateLimits(at = new Date()) {
  const { count } = await prisma.rateLimit.deleteMany({ where: { windowStart: { lt: new Date(at.getTime() - 24 * 3600_000) } } });
  return count;
}
