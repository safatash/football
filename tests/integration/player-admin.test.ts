import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auth, hasDb, type TestUser } from "./setup";

describe.skipIf(!hasDb)("player and league-office admin tools (database)", async () => {
  const { default: prisma } = await import("@/lib/prisma");
  const admin = await import("@/lib/actions/admin");
  const { matchPool } = await import("@/lib/queries/teams");

  const NEW_EMAIL = "itest.new.player@example.com";
  const ids = {} as Record<string, string>;
  const users = {} as Record<string, TestUser>;

  async function userFor(email: string, isAdmin = false): Promise<TestUser> {
    const u = await prisma.user.findUniqueOrThrow({ where: { email }, include: { player: true } });
    return { id: u.id, email: u.email, name: u.email, playerId: u.player?.id, isAdmin };
  }
  const as = (who: string | null) => (auth.user = who ? users[who] : null);

  async function cleanup() {
    await prisma.user.deleteMany({ where: { email: NEW_EMAIL } });
    await prisma.user.updateMany({ where: { email: "hannah.cole@example.com" }, data: { role: "PLAYER" } });
  }

  beforeAll(async () => {
    const season = await prisma.season.findFirstOrThrow({ where: { isActive: true } });
    const team = (code: string) => prisma.team.findFirstOrThrow({ where: { seasonId: season.id, code } });
    ids.ffx = (await team("ffx")).id;
    ids.alx = (await team("alx")).id;
    ids.md1Team = (await team("nvs")).id;
    ids.cc = (await team("vie")).id;
    ids.m204 = (await prisma.match.findUniqueOrThrow({ where: { seasonId_gameNumber: { seasonId: season.id, gameNumber: 204 } } })).id;
    users.admin = await userFor("safatash@gmail.com", true);
    users.hannah = await userFor("hannah.cole@example.com");
    ids.hannahPlayer = users.hannah!.playerId!;
    await cleanup();
    // Hannah back on Fairfax with her jersey, off Vienna, in case an earlier run stopped midway
    await prisma.teamRoster.updateMany({ where: { playerId: ids.hannahPlayer, teamId: ids.ffx, membershipType: "SEASONAL" }, data: { leftAt: null } });
    await prisma.teamRoster.deleteMany({ where: { playerId: ids.hannahPlayer, teamId: ids.cc } });
  });
  afterAll(async () => {
    await cleanup();
    await prisma.teamRoster.updateMany({ where: { playerId: ids.hannahPlayer, teamId: ids.ffx, membershipType: "SEASONAL" }, data: { leftAt: null } });
    await prisma.teamRoster.deleteMany({ where: { playerId: ids.hannahPlayer, teamId: ids.cc } });
  });

  describe("create a player account", () => {
    const base = { firstName: "Iris", lastName: "Testwell", email: NEW_EMAIL, dob: "1996-04-04", gender: "FEMALE" as const, phone: "", zip: "22030", position: "MID" as const };

    it("checks eligibility and the jersey before creating anything", async () => {
      as("admin");
      expect(await admin.createPlayerAccount({ ...base, teamId: ids.md1Team })).toMatchObject({ ok: false, status: 400, error: expect.stringMatching(/Men only/) });
      expect(await admin.createPlayerAccount({ ...base, teamId: ids.ffx, jerseyNumber: 9 })).toMatchObject({ ok: false, status: 409, error: expect.stringMatching(/#9 is already Maya Johnson/) });
      expect(await prisma.user.count({ where: { email: NEW_EMAIL } })).toBe(0);
    });

    it("creates an approved player on a team, with a 7-day invitation link", async () => {
      as("admin");
      const res = await admin.createPlayerAccount({ ...base, teamId: ids.alx, jerseyNumber: 99 });
      expect(res).toMatchObject({ ok: true });
      const user = await prisma.user.findUniqueOrThrow({ where: { email: NEW_EMAIL }, include: { player: { include: { teamMemberships: true } } } });
      expect(user.role).toBe("PLAYER");
      expect(user.player).toMatchObject({ finalApproval: "APPROVED", status: "ACTIVE", city: "Fairfax", fairfaxCounty: true });
      expect(user.player!.teamMemberships).toMatchObject([{ teamId: ids.alx, jerseyNumber: 99, membershipType: "SEASONAL", leftAt: null }]);
      const token = await prisma.verificationToken.findFirstOrThrow({ where: { identifier: `reset:${user.id}` } });
      expect(token.expires.getTime() - Date.now()).toBeGreaterThan(6 * 24 * 3600_000);
    });

    it("refuses an email that already has an account", async () => {
      as("admin");
      expect(await admin.createPlayerAccount(base)).toMatchObject({ ok: false, status: 409 });
    });
  });

  describe("team rosters", () => {
    it("adds an existing player to a second team, checking eligibility and duplicates", async () => {
      as("admin");
      expect(await admin.addPlayerToTeam({ playerId: ids.hannahPlayer, teamId: ids.md1Team })).toMatchObject({ ok: false, status: 400 });
      expect(await admin.addPlayerToTeam({ playerId: ids.hannahPlayer, teamId: ids.ffx })).toMatchObject({ ok: false, status: 409 });
      expect(await admin.addPlayerToTeam({ playerId: ids.hannahPlayer, teamId: ids.cc, jerseyNumber: 2 })).toMatchObject({ ok: true });
      expect(await prisma.teamRoster.count({ where: { playerId: ids.hannahPlayer, leftAt: null, membershipType: "SEASONAL" } })).toBe(2);
    });

    it("removes a player: roster closed, captain access and upcoming draft spots gone", async () => {
      as("admin");
      const row = await prisma.teamRoster.findFirstOrThrow({ where: { playerId: ids.hannahPlayer, teamId: ids.ffx, membershipType: "SEASONAL" } });
      await prisma.teamRoster.update({ where: { id: row.id }, data: { isCaptain: true } });
      // Put her on a draft roster for Game #204
      const draft = await prisma.matchRoster.upsert({
        where: { matchId_teamId: { matchId: ids.m204, teamId: ids.ffx } },
        update: { status: "DRAFT" },
        create: { matchId: ids.m204, teamId: ids.ffx, status: "DRAFT" },
      });
      await prisma.matchRosterEntry.upsert({ where: { matchRosterId_teamRosterId: { matchRosterId: draft.id, teamRosterId: row.id } }, update: {}, create: { matchRosterId: draft.id, teamRosterId: row.id } });

      expect(await admin.removePlayerFromTeam({ playerId: ids.hannahPlayer, teamId: ids.ffx })).toMatchObject({ ok: true });
      const after = await prisma.teamRoster.findUniqueOrThrow({ where: { id: row.id } });
      expect(after.leftAt).not.toBeNull();
      expect(after.isCaptain).toBe(false);
      // Gone from the upcoming draft; finalized rosters of played games keep her as history
      expect(await prisma.matchRosterEntry.count({ where: { teamRosterId: row.id, matchRosterId: draft.id } })).toBe(0);
      expect(await prisma.matchRosterEntry.count({ where: { teamRosterId: row.id, matchRoster: { status: "FINALIZED" } } })).toBeGreaterThan(0);
      expect((await matchPool(ids.ffx, ids.m204)).some((m) => m.player.id === ids.hannahPlayer)).toBe(false);
      expect(await admin.removePlayerFromTeam({ playerId: ids.hannahPlayer, teamId: ids.ffx })).toMatchObject({ ok: false, status: 404 });
    });

    it("can put a removed player back, reusing their membership", async () => {
      as("admin");
      expect(await admin.addPlayerToTeam({ playerId: ids.hannahPlayer, teamId: ids.ffx, jerseyNumber: 2 })).toMatchObject({ ok: true });
      expect(await prisma.teamRoster.count({ where: { playerId: ids.hannahPlayer, teamId: ids.ffx, membershipType: "SEASONAL" } })).toBe(1);
      expect(await admin.removePlayerFromTeam({ playerId: ids.hannahPlayer, teamId: ids.cc })).toMatchObject({ ok: true });
    });
  });

  describe("league-office access", () => {
    it("grants and revokes by email", async () => {
      as("admin");
      expect(await admin.setLeagueOfficeAccess({ email: "Hannah.Cole@example.com", admin: true })).toMatchObject({ ok: true });
      expect((await prisma.user.findUniqueOrThrow({ where: { email: "hannah.cole@example.com" } })).role).toBe("ADMIN");
      expect(await admin.setLeagueOfficeAccess({ email: "hannah.cole@example.com", admin: true })).toMatchObject({ ok: false, status: 409 });
      expect(await admin.setLeagueOfficeAccess({ email: "hannah.cole@example.com", admin: false })).toMatchObject({ ok: true });
      expect((await prisma.user.findUniqueOrThrow({ where: { email: "hannah.cole@example.com" } })).role).toBe("PLAYER");
    });

    it("a newly granted admin can use admin actions; players can't grant themselves", async () => {
      as("hannah");
      expect(await admin.setLeagueOfficeAccess({ email: "hannah.cole@example.com", admin: true })).toMatchObject({ ok: false, status: 403 });
      as("admin");
      await admin.setLeagueOfficeAccess({ email: "hannah.cole@example.com", admin: true });
      as("hannah");
      expect(await admin.addAllowedZip({ zip: "22030" })).toMatchObject({ ok: false, status: 409 }); // passed the admin check
      as("admin");
      await admin.setLeagueOfficeAccess({ email: "hannah.cole@example.com", admin: false });
    });

    it("won't remove your own access, ADMIN_EMAILS addresses, or unknown accounts", async () => {
      as("admin");
      expect(await admin.setLeagueOfficeAccess({ email: "safatash@gmail.com", admin: false })).toMatchObject({ ok: false, status: 409, error: expect.stringMatching(/your own/) });
      expect(await admin.setLeagueOfficeAccess({ email: "nobody.here@example.com", admin: true })).toMatchObject({ ok: false, status: 404 });
    });
  });
});
