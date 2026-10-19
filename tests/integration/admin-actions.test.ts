import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auth, hasDb, type TestUser } from "./setup";
import { NVASA_ORG_ID, playerInOrg } from "@/lib/org";

describe.skipIf(!hasDb)("admin actions (database)", async () => {
  const { default: prisma } = await import("@/lib/prisma");
  const admin = await import("@/lib/actions/admin");
  const { loadStandings } = await import("@/lib/queries/standings");
  const approveRoute = await import("@/app/api/admin/registrations/[id]/approve/route");
  const denyRoute = await import("@/app/api/admin/registrations/[id]/deny/route");

  const ids = {} as Record<string, string>;
  const users = {} as Record<string, TestUser>;

  async function userFor(email: string, isAdmin = false): Promise<TestUser> {
    const u = await prisma.user.findUniqueOrThrow({ where: { email }, include: { players: playerInOrg() } });
    return { id: u.id, email: u.email, name: u.email, playerId: u.players[0]?.id, isAdmin };
  }
  const as = (who: string | null) => (auth.user = who ? users[who] : null);
  const post = (handler: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>, id: string, body: unknown) =>
    handler(new NextRequest(`http://localhost/api/admin/registrations/${id}`, { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });

  beforeAll(async () => {
    const season = await prisma.season.findFirstOrThrow({ where: { isActive: true } });
    const archived = await prisma.season.findFirstOrThrow({ where: { isActive: false } });
    ids.season = season.id;
    ids.archived = archived.id;
    const team = (code: string) => prisma.team.findFirstOrThrow({ where: { seasonId: season.id, code } });
    ids.nvs = (await team("nvs")).id;
    ids.arl = (await team("arl")).id;
    ids.md1 = (await prisma.division.findUniqueOrThrow({ where: { seasonId_code: { seasonId: season.id, code: "md1" } } })).id;
    ids.m205 = (await prisma.match.findUniqueOrThrow({ where: { seasonId_gameNumber: { seasonId: season.id, gameNumber: 205 } } })).id;
    users.admin = await userFor("safatash@gmail.com", true);
    users.maya = await userFor("maya.johnson@example.com");
    // Fixtures this file changes
    ids.hector = (await prisma.registration.findFirstOrThrow({ where: { number: 2033 } })).id; // placement, md1
    ids.tyler = (await prisma.registration.findFirstOrThrow({ where: { number: 2038 } })).id; // submitted, md1
    ids.devonReq = (await prisma.captainRequest.findFirstOrThrow({ where: { player: { lastName: "Price" } } })).id;
    ids.devonPlayer = (await prisma.player.findFirstOrThrow({ where: { lastName: "Price" } })).id;
    await prisma.discountCode.deleteMany({ where: { code: { in: ["ITEST5", "ITEST-OLD"] } } });
  });

  afterAll(async () => {
    await prisma.discountCode.deleteMany({ where: { code: { in: ["ITEST5", "ITEST-OLD"] } } });
    await prisma.blocklist.deleteMany({ where: { email: "itest.example" } });
    await prisma.allowedZipCode.deleteMany({ where: { zipCode: "22999" } });
  });

  describe("authorization", () => {
    it("non-admins get 403 from admin actions and API routes", async () => {
      as("maya");
      const results = await Promise.all([
        admin.confirmReport({ matchId: ids.m205, teamId: ids.nvs }),
        admin.suspendPlayer({ playerId: ids.devonPlayer, reason: "Conduct", until: null }),
        admin.assignPlacement({ registrationId: ids.hector, teamId: ids.nvs }),
        admin.saveSettings({ seasonId: ids.season, divisions: [], gamePassFee: 1, fairfaxCountyAllowed: true }),
        admin.addBlock({ entry: "itest.example" }),
        admin.decideCaptainRequest({ requestId: ids.devonReq, approve: true }),
      ]);
      for (const r of results) expect(r).toMatchObject({ ok: false, status: 403 });
      expect((await post(approveRoute.POST, ids.tyler, { teamId: ids.nvs })).status).toBe(403);
      expect((await post(denyRoute.POST, ids.tyler, { reason: "Other" })).status).toBe(403);
    });

    it("signed-out users get 401", async () => {
      as(null);
      expect(await admin.addAllowedZip({ zip: "22999" })).toMatchObject({ ok: false, status: 401 });
      expect((await post(approveRoute.POST, ids.tyler, {})).status).toBe(401);
    });

    it("archived seasons are read-only", async () => {
      as("admin");
      const res = await admin.createDiscountCode({ seasonId: ids.archived, code: "ITEST-OLD", kind: "PROMO", type: "AMOUNT", value: 5 });
      expect(res).toMatchObject({ ok: false, status: 409 });
    });
  });

  describe("registrations and captains", () => {
    it("deny stores the reason and message, reopen sends it back", async () => {
      as("admin");
      const res = await post(denyRoute.POST, ids.tyler, { reason: "Duplicate registration", message: "You already registered as R-2001." });
      expect(res.status).toBe(200);
      const denied = await prisma.registration.findUniqueOrThrow({ where: { id: ids.tyler } });
      expect(denied).toMatchObject({ status: "REJECTED", deniedReason: "Duplicate registration", deniedMessage: "You already registered as R-2001." });
      expect(await admin.reopenRegistration({ registrationId: ids.tyler })).toMatchObject({ ok: true });
      expect(await prisma.registration.findUniqueOrThrow({ where: { id: ids.tyler } })).toMatchObject({ status: "SUBMITTED", deniedReason: null });
    });

    it("approving a captain request needs a roster spot, then grants access on that team only", async () => {
      as("admin");
      const req = await prisma.captainRequest.findUniqueOrThrow({ where: { id: ids.devonReq } });
      if (req.status === "PENDING") {
        const membership = await prisma.teamRoster.findFirst({ where: { playerId: ids.devonPlayer, teamId: req.teamId, leftAt: null } });
        if (!membership) {
          expect(await admin.decideCaptainRequest({ requestId: ids.devonReq, approve: true })).toMatchObject({ ok: false, status: 409 });
          const team = await prisma.team.findUniqueOrThrow({ where: { id: req.teamId } });
          await prisma.teamRoster.create({ data: { playerId: ids.devonPlayer, teamId: team.id, divisionId: team.divisionId } });
        }
        expect(await admin.decideCaptainRequest({ requestId: ids.devonReq, approve: true })).toMatchObject({ ok: true });
      }
      const rows = await prisma.teamRoster.findMany({ where: { playerId: ids.devonPlayer, leftAt: null } });
      expect(rows.filter((r) => r.isCaptain).map((r) => r.teamId)).toEqual([req.teamId]);
      expect(await admin.decideCaptainRequest({ requestId: ids.devonReq, approve: false })).toMatchObject({ ok: false, status: 409 });
    });
  });

  it("placement assignment adds the roster row and approves", async () => {
    as("admin");
    expect(await admin.assignPlacement({ registrationId: ids.hector, teamId: ids.arl })).toMatchObject({ ok: true });
    const reg = await prisma.registration.findUniqueOrThrow({ where: { id: ids.hector } });
    expect(reg).toMatchObject({ placementState: "ASSIGNED", status: "APPROVED", divisionId: ids.md1 });
    expect(await prisma.teamRoster.count({ where: { playerId: reg.playerId, teamId: ids.arl, membershipType: "SEASONAL", leftAt: null } })).toBe(1);
  });

  it("suspend and lift keep Player.status in sync", async () => {
    as("admin");
    expect(await admin.suspendPlayer({ playerId: ids.devonPlayer, reason: "Conduct", until: "2026-06-30" })).toMatchObject({ ok: true });
    expect((await prisma.player.findUniqueOrThrow({ where: { id: ids.devonPlayer } })).status).toBe("SUSPENDED");
    expect(await admin.liftSuspension({ playerId: ids.devonPlayer })).toMatchObject({ ok: true });
    expect((await prisma.player.findUniqueOrThrow({ where: { id: ids.devonPlayer } })).status).toBe("ACTIVE");
    expect(await prisma.suspension.count({ where: { playerId: ids.devonPlayer, liftedAt: null } })).toBe(0);
  });

  it("confirming a report updates the standings", async () => {
    as("admin");
    const report = await prisma.matchReport.findUnique({ where: { matchId_teamId: { matchId: ids.m205, teamId: ids.nvs } } });
    const before = await loadStandings(ids.season, ids.md1);
    const playedBefore = before.find((r) => r.team.id === ids.nvs)!.played;
    if (report?.status === "SUBMITTED") {
      expect(await admin.confirmReport({ matchId: ids.m205, teamId: ids.nvs })).toMatchObject({ ok: true });
      const after = await loadStandings(ids.season, ids.md1);
      expect(after.find((r) => r.team.id === ids.nvs)!.played).toBe(playedBefore + 1);
      expect(await prisma.match.findUniqueOrThrow({ where: { id: ids.m205 } })).toMatchObject({ reportStatus: "CONFIRMED", status: "COMPLETED" });
    }
    expect(await admin.confirmReport({ matchId: ids.m205, teamId: ids.nvs })).toMatchObject({ ok: false, status: 409 });
  });

  it("settings, discount codes, ZIPs and the blocklist persist", async () => {
    as("admin");
    const div = await prisma.division.findUniqueOrThrow({ where: { id: ids.md1 } });
    const settings = await prisma.leagueSettings.findUniqueOrThrow({ where: { seasonId: ids.season } });
    expect(
      await admin.saveSettings({ seasonId: ids.season, divisions: [{ id: div.id, fee: 110, cutoff: "2008-03-29" }], gamePassFee: 17, fairfaxCountyAllowed: true }),
    ).toMatchObject({ ok: true });
    expect(Number((await prisma.division.findUniqueOrThrow({ where: { id: div.id } })).registrationFee)).toBe(110);
    expect(Number((await prisma.leagueSettings.findUniqueOrThrow({ where: { seasonId: ids.season } })).gamePassFee)).toBe(17);
    // restore
    await prisma.division.update({ where: { id: div.id }, data: { registrationFee: div.registrationFee } });
    await prisma.leagueSettings.update({ where: { id: settings.id }, data: { gamePassFee: settings.gamePassFee } });

    expect(await admin.createDiscountCode({ seasonId: ids.season, code: "itest5", kind: "PROMO", type: "PERCENT", value: 150 })).toMatchObject({ ok: false, status: 400 });
    expect(await admin.createDiscountCode({ seasonId: ids.season, code: "itest5", kind: "PROMO", type: "AMOUNT", value: 5, maxUses: 10 })).toMatchObject({ ok: true });
    const created = await prisma.discountCode.findUniqueOrThrow({ where: { organizationId_code: { organizationId: NVASA_ORG_ID, code: "ITEST5" } } });
    expect(await admin.setDiscountCodeActive({ id: created.id, active: false })).toMatchObject({ ok: true });
    expect(await admin.deleteDiscountCode({ id: created.id })).toMatchObject({ ok: true });
    const used = await prisma.discountCode.findUniqueOrThrow({ where: { organizationId_code: { organizationId: NVASA_ORG_ID, code: "SPRING10" } } });
    expect(await admin.deleteDiscountCode({ id: used.id })).toMatchObject({ ok: false, status: 409 });

    expect(await admin.addAllowedZip({ zip: "22030" })).toMatchObject({ ok: false, status: 409 });
    expect(await admin.addAllowedZip({ zip: "22999" })).toMatchObject({ ok: true });
    expect(await admin.removeAllowedZip({ zip: "22999" })).toMatchObject({ ok: true });
    expect(await admin.addBlock({ entry: "ITEST.example" })).toMatchObject({ ok: true });
    expect(await admin.removeBlock({ entry: "itest.example" })).toMatchObject({ ok: true });
  });
});
