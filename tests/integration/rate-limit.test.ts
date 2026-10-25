/**
 * Rate limits and the bot honeypot on login, account recovery and registration
 * (src/platform/rate-limit.ts). Counters are rows in `rate_limits`, so they hold across
 * serverless instances.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auth, hasDb } from "./setup";

describe.skipIf(!hasDb)("rate limits and bot protection (database)", async () => {
  const { NextRequest } = await import("next/server");
  const { default: raw } = await import("@/platform/prisma");
  const { LIMITS, hit, pruneRateLimits } = await import("@/platform/rate-limit");
  const reset = await import("@/app/api/account/password-reset/route");
  const register = await import("@/app/api/register/new/route");
  const { authOptions } = await import("@/lib/auth");

  const run = `itest-${Date.now()}`;
  const ip = (n: number) => `203.0.113.${n}`; // documentation range
  const post = (handler: (r: InstanceType<typeof NextRequest>) => Promise<Response>, url: string, body: unknown, fromIp: string) =>
    handler(new NextRequest(`http://localhost${url}`, { method: "POST", body: JSON.stringify(body), headers: { "x-forwarded-for": `${fromIp}, 10.0.0.1` } }));

  let office: { id: string; email: string };
  const resetTokens = () => raw.verificationToken.count({ where: { identifier: `reset:${office.id}` } });

  beforeAll(async () => {
    auth.user = null;
    office = await raw.user.findUniqueOrThrow({ where: { email: "safatash@gmail.com" }, select: { id: true, email: true } });
    await raw.verificationToken.deleteMany({ where: { identifier: `reset:${office.id}` } });
  });
  afterAll(async () => {
    await raw.rateLimit.deleteMany({ where: { OR: [{ key: { startsWith: run } }, { key: { contains: "203.0.113." } }, { key: { contains: "safatash@gmail.com" } }] } });
    await raw.verificationToken.deleteMany({ where: { identifier: `reset:${office.id}` } });
  });

  it("counts per key and fixed window, and says when to come back", async () => {
    const at = new Date("2026-05-16T12:00:30Z");
    const lim = { limit: 3, windowSec: 60 };
    for (let i = 0; i < 3; i++) expect(await hit(`${run}:a`, lim, at)).toEqual({ ok: true });
    expect(await hit(`${run}:a`, lim, at)).toEqual({ ok: false, retryAfterSec: 30 });
    expect(await hit(`${run}:b`, lim, at)).toEqual({ ok: true }); // another key
    expect(await hit(`${run}:a`, lim, new Date("2026-05-16T12:01:00Z"))).toEqual({ ok: true }); // next window
  });

  it("password reset requests: 429 with Retry-After once an email asks too often", async () => {
    for (let i = 0; i < LIMITS.recoveryEmail.limit; i++) {
      expect((await post(reset.POST, "/api/account/password-reset", { email: office.email }, ip(10 + i))).status).toBe(200);
    }
    const blocked = await post(reset.POST, "/api/account/password-reset", { email: office.email.toUpperCase() }, ip(30));
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(((await blocked.json()) as { error: string }).error).toMatch(/Too many requests/);
  });

  it("the honeypot: a filled hidden field gets the normal answer and nothing is sent", async () => {
    await raw.rateLimit.deleteMany({ where: { key: { contains: "safatash@gmail.com" } } });
    await raw.verificationToken.deleteMany({ where: { identifier: `reset:${office.id}` } });
    const res = await post(reset.POST, "/api/account/password-reset", { email: office.email, website: "https://spam.example" }, ip(40));
    expect(res.status).toBe(200);
    expect(await resetTokens()).toBe(0);
    // Without it, the same request creates a reset token
    expect((await post(reset.POST, "/api/account/password-reset", { email: office.email }, ip(41))).status).toBe(200);
    expect(await resetTokens()).toBe(1);
  });

  it("registration: limited per address, and the honeypot is refused", async () => {
    expect((await post(register.POST, "/api/register/new", { website: "x" }, ip(50))).status).toBe(400);
    for (let i = 1; i < LIMITS.registerIp.limit; i++) await post(register.POST, "/api/register/new", {}, ip(50));
    expect((await post(register.POST, "/api/register/new", {}, ip(50))).status).toBe(429);
    expect((await post(register.POST, "/api/register/new", {}, ip(51))).status).toBe(400); // another address: normal validation
  });

  it("sign-in: too many attempts for one email are refused before the password is checked", async () => {
    const authorize = (authOptions.providers[0] as unknown as { options: { authorize: (c: Record<string, string>) => Promise<unknown> } }).options.authorize;
    const email = `${run}-nobody@example.com`;
    for (let i = 0; i < LIMITS.loginEmail.limit; i++) await expect(authorize({ email, password: "wrong" })).rejects.toThrow(/No user found/);
    await expect(authorize({ email, password: "wrong" })).rejects.toThrow("RATE_LIMITED");
    await raw.rateLimit.deleteMany({ where: { key: { contains: email } } });
  });

  it("the daily cron deletes windows older than a day", async () => {
    await hit(`${run}:old`, { limit: 1, windowSec: 60 }, new Date("2020-01-01T00:00:00Z"));
    expect(await pruneRateLimits()).toBeGreaterThanOrEqual(1);
    expect(await raw.rateLimit.count({ where: { key: `${run}:old` } })).toBe(0);
  });
});
