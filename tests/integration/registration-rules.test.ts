/**
 * Season registration rules on the server (POST /api/register/new): the league's open switch and
 * the season's registration dates block registering, the waiver must be accepted when the league
 * requires it (and its acceptance is recorded), and an emergency contact is required and saved on
 * the player. Uses a returning player and a 100% code, so no Stripe checkout is created.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auth, hasDb } from "./setup";

describe.skipIf(!hasDb)("registration rules (database)", async () => {
  const { NextRequest } = await import("next/server");
  const { POST } = await import("@/app/api/register/new/route");
  const { checkEligibility } = await import("@/lib/eligibility");
  const prisma = (await import("@/platform/db")).clientForOrg("org_nvasa");

  const ORG = "org_nvasa";
  const CODE = "ITESTFREE";
  let season: { id: string; startDate: Date; registrationOpensOn: Date | null; registrationClosesOn: Date | null };
  let settings: { registrationOpen: boolean; waiverRequired: boolean };
  let player: { id: string; emergencyContactName: string | null; emergencyContactPhone: string | null };
  let divisionCode = "";

  const register = async (body: Record<string, unknown>) => {
    const res = await POST(new NextRequest("http://localhost/api/register/new", { method: "POST", body: JSON.stringify(body) }));
    return { status: res.status, body: (await res.json()) as { error?: string; success?: boolean } };
  };
  const valid = () => ({ divisionCode, discountCode: CODE, waiverAccepted: true, emergencyName: "Pat Rivera", emergencyPhone: "703-555-0199" });
  const setRules = (data: Partial<typeof settings>) => prisma.organizationSettings.update({ where: { organizationId: ORG }, data });

  async function cleanup() {
    const regs = await prisma.registration.findMany({ where: { discountCode: { code: CODE } }, select: { id: true } });
    await prisma.captainRequest.deleteMany({ where: { registrationId: { in: regs.map((r) => r.id) } } });
    await prisma.registration.deleteMany({ where: { id: { in: regs.map((r) => r.id) } } });
    await prisma.discountCode.deleteMany({ where: { code: CODE } });
  }

  beforeAll(async () => {
    const s = await prisma.season.findFirstOrThrow({ where: { isActive: true } });
    season = { id: s.id, startDate: s.startDate, registrationOpensOn: s.registrationOpensOn, registrationClosesOn: s.registrationClosesOn };
    const st = await prisma.organizationSettings.findUniqueOrThrow({ where: { organizationId: ORG } });
    settings = { registrationOpen: st.registrationOpen, waiverRequired: st.waiverRequired };
    await cleanup();

    // A seeded player and an open division they're eligible for and not registered in
    const divisions = await prisma.division.findMany({ where: { seasonId: s.id, status: "ACTIVE" } });
    const players = await prisma.player.findMany({ where: { status: "ACTIVE", user: { email: { endsWith: "@example.com" } } }, include: { user: true, registrations: { where: { seasonId: s.id } } }, take: 40 });
    for (const p of players) {
      const d = divisions.find((x) => checkEligibility(x, { dob: p.dob, gender: p.gender }, s.startDate).ok && !p.registrations.some((r) => r.divisionId === x.id));
      if (d) {
        player = { id: p.id, emergencyContactName: p.emergencyContactName, emergencyContactPhone: p.emergencyContactPhone };
        divisionCode = d.code;
        auth.user = { id: p.userId, email: p.user.email, name: p.firstName, playerId: p.id };
        break;
      }
    }
    expect(divisionCode).not.toBe("");
    await prisma.discountCode.create({ data: { code: CODE, kind: "PROMO", type: "PERCENT", value: 100, seasonId: s.id } });
  });

  afterAll(async () => {
    await cleanup();
    await setRules(settings);
    await prisma.season.update({ where: { id: season.id }, data: { registrationOpensOn: season.registrationOpensOn, registrationClosesOn: season.registrationClosesOn } });
    await prisma.player.update({ where: { id: player.id }, data: { emergencyContactName: player.emergencyContactName, emergencyContactPhone: player.emergencyContactPhone } });
    auth.user = null;
  });

  it("the league's switch closes registration", async () => {
    await setRules({ registrationOpen: false, waiverRequired: true });
    expect(await register(valid())).toMatchObject({ status: 400, body: { error: expect.stringContaining("isn’t open") } });
    await setRules({ registrationOpen: true });
  });

  it("the season's registration dates close it before and after the window", async () => {
    // The tests run as of May 16, 2026 (NVASA_NOW)
    await prisma.season.update({ where: { id: season.id }, data: { registrationOpensOn: new Date("2026-06-01T00:00:00Z"), registrationClosesOn: null } });
    expect(await register(valid())).toMatchObject({ status: 400, body: { error: expect.stringContaining("opens Jun 1, 2026") } });
    await prisma.season.update({ where: { id: season.id }, data: { registrationOpensOn: null, registrationClosesOn: new Date("2026-05-15T00:00:00Z") } });
    expect(await register(valid())).toMatchObject({ status: 400, body: { error: expect.stringContaining("closed May 15, 2026") } });
    await prisma.season.update({ where: { id: season.id }, data: { registrationOpensOn: new Date("2026-05-16T00:00:00Z"), registrationClosesOn: new Date("2026-05-16T00:00:00Z") } });
  });

  it("requires the waiver when the league does, and an emergency contact", async () => {
    expect(await register({ ...valid(), waiverAccepted: false })).toMatchObject({ status: 400, body: { error: expect.stringContaining("waiver") } });
    expect(await register({ ...valid(), emergencyName: "" })).toMatchObject({ status: 400, body: { error: expect.stringContaining("emergency contact") } });
    expect(await register({ ...valid(), emergencyPhone: "555" })).toMatchObject({ status: 400 });
  });

  it("records the waiver acceptance and saves the emergency contact on the player", async () => {
    const before = Date.now();
    expect(await register(valid())).toMatchObject({ status: 200, body: { success: true } });
    const reg = await prisma.registration.findFirstOrThrow({ where: { playerId: player.id, discountCode: { code: CODE } } });
    expect(reg.status).toBe("PENDING"); // free: straight to review
    expect(reg.waiverAcceptedAt?.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(await prisma.player.findUniqueOrThrow({ where: { id: player.id } })).toMatchObject({ emergencyContactName: "Pat Rivera", emergencyContactPhone: "703-555-0199" });
  });

  it("without a required waiver, registering works and records no acceptance", async () => {
    await cleanup();
    await prisma.discountCode.create({ data: { code: CODE, kind: "PROMO", type: "PERCENT", value: 100, seasonId: season.id } });
    await setRules({ waiverRequired: false });
    expect(await register({ ...valid(), waiverAccepted: false })).toMatchObject({ status: 200 });
    const reg = await prisma.registration.findFirstOrThrow({ where: { playerId: player.id, discountCode: { code: CODE } } });
    expect(reg.waiverAcceptedAt).toBeNull();
  });
});
