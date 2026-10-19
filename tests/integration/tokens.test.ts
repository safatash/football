import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { hasDb } from "./setup";

describe.skipIf(!hasDb)("login links and password reset (database)", async () => {
  // NVASA's rows, through the league-scoped client (the Demo League shares names with NVASA)
  const prisma = (await import("@/platform/db")).clientForOrg("org_nvasa");
  const { consumeToken, createToken, peekToken } = await import("@/lib/tokens");
  const { verifyPassword, hashPassword } = await import("@/lib/password");
  const confirm = await import("@/app/api/account/password-reset/confirm/route");
  const linkRoute = await import("@/app/api/account/login-link/route");
  const req = (url: string, body: unknown) => new NextRequest(url, { method: "POST", body: JSON.stringify(body) });

  let userId = "";
  let original = "";
  beforeAll(async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const u = await prisma.user.findUniqueOrThrow({ where: { email: "hannah.cole@example.com" } });
    userId = u.id;
    original = u.password;
  });
  afterAll(async () => {
    await prisma.user.update({ where: { id: userId }, data: { password: original } });
    await prisma.verificationToken.deleteMany({ where: { identifier: { in: [`login:${userId}`, `reset:${userId}`] } } });
  });

  it("tokens work once, for their purpose only, and are stored hashed", async () => {
    const token = await createToken("login", userId);
    expect(await prisma.verificationToken.count({ where: { token } })).toBe(0);
    expect(await consumeToken("reset", token)).toBeNull();
    expect(await peekToken("login", token)).toBe(true);
    expect(await consumeToken("login", token)).toBe(userId);
    expect(await consumeToken("login", token)).toBeNull();
  });

  it("expired tokens don't work", async () => {
    const token = await createToken("login", userId);
    await prisma.verificationToken.updateMany({ where: { identifier: `login:${userId}` }, data: { expires: new Date(Date.now() - 1000) } });
    expect(await peekToken("login", token)).toBe(false);
    expect(await consumeToken("login", token)).toBeNull();
  });

  it("a new link replaces the old one", async () => {
    const first = await createToken("login", userId);
    const second = await createToken("login", userId);
    expect(await consumeToken("login", first)).toBeNull();
    expect(await consumeToken("login", second)).toBe(userId);
  });

  it("password reset sets the new password once and enforces the rules", async () => {
    const token = await createToken("reset", userId);
    const weak = await confirm.POST(req("http://localhost/api/account/password-reset/confirm", { token, password: "short" }));
    expect(weak.status).toBe(400);
    const ok = await confirm.POST(req("http://localhost/api/account/password-reset/confirm", { token, password: "BrandNewPass26" }));
    expect(ok.status).toBe(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(await verifyPassword("BrandNewPass26", user.password)).toBe(true);
    const again = await confirm.POST(req("http://localhost/api/account/password-reset/confirm", { token, password: "AnotherPass26" }));
    expect(again.status).toBe(410);
    await prisma.user.update({ where: { id: userId }, data: { password: await hashPassword("NvasaPlayer26") } });
  });

  it("login-link requests answer the same whether or not the details match", async () => {
    const before = await prisma.verificationToken.count({ where: { identifier: `login:${userId}` } });
    const wrong = await linkRoute.POST(req("http://localhost/api/account/login-link", { email: "hannah.cole@example.com", dob: "1900-01-01" }));
    const unknown = await linkRoute.POST(req("http://localhost/api/account/login-link", { email: "nobody@example.com", dob: "1990-01-01" }));
    expect([wrong.status, unknown.status]).toEqual([200, 200]);
    expect(await wrong.json()).toEqual(await unknown.json());
    expect(await prisma.verificationToken.count({ where: { identifier: `login:${userId}` } })).toBe(before);
    const player = await prisma.player.findFirstOrThrow({ where: { userId } });
    await linkRoute.POST(req("http://localhost/api/account/login-link", { email: "Hannah.Cole@example.com", dob: player.dob.toISOString().slice(0, 10) }));
    expect(await prisma.verificationToken.count({ where: { identifier: `login:${userId}` } })).toBe(1);
  });
});
