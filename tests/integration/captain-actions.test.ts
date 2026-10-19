import { beforeAll, describe, expect, it } from "vitest";
import { auth, hasDb, type TestUser } from "./setup";
import { playerInOrg } from "@/lib/org";

describe.skipIf(!hasDb)("captain actions (database)", async () => {
  const { default: prisma } = await import("@/lib/prisma");
  const actions = await import("@/lib/actions/captain");

  const ids = {} as Record<string, string>;
  const users = {} as Record<string, TestUser>;
  const roster = {} as Record<string, string>; // name → FFX TeamRoster id

  async function userFor(email: string, isAdmin = false): Promise<TestUser> {
    const u = await prisma.user.findUniqueOrThrow({ where: { email }, include: { players: playerInOrg() } });
    return { id: u.id, email: u.email, name: u.players[0] ? `${u.players[0].firstName} ${u.players[0].lastName}` : u.email, playerId: u.players[0]?.id, isAdmin };
  }

  beforeAll(async () => {
    const season = await prisma.season.findFirstOrThrow({ where: { isActive: true } });
    const team = (code: string) => prisma.team.findFirstOrThrow({ where: { seasonId: season.id, code } });
    const match = (n: number) => prisma.match.findUniqueOrThrow({ where: { seasonId_gameNumber: { seasonId: season.id, gameNumber: n } } });
    ids.ffx = (await team("ffx")).id;
    ids.alx = (await team("alx")).id;
    ids.m204 = (await match(204)).id;
    ids.m203 = (await match(203)).id;
    ids.m209 = (await match(209)).id;
    users.maya = await userFor("maya.johnson@example.com");
    users.hannah = await userFor("hannah.cole@example.com");
    users.admin = await userFor("safatash@gmail.com", true);
    const rows = await prisma.teamRoster.findMany({ where: { teamId: ids.ffx }, include: { player: true } });
    for (const r of rows) roster[`${r.player.firstName} ${r.player.lastName}`] = r.id;
    // Start from a clean slate for the rows these tests write
    await prisma.matchRoster.deleteMany({ where: { teamId: ids.ffx, matchId: { in: [ids.m204, ids.m209] } } });
    await prisma.matchReport.deleteMany({ where: { teamId: ids.ffx, matchId: ids.m203 } });
  });

  const as = (who: keyof typeof users | null) => (auth.user = who ? users[who] : null);
  const pick = (...names: string[]) => names.map((n) => roster[n]);
  const squad = () =>
    pick("Priya Raman", "Hannah Cole", "Ana Morales", "Keisha Brooks", "Sofia Russo", "Jen Park", "Emma Kowalski", "Maya Johnson", "Tasha Greene", "Rachel Stein", "Claire Dubois", "Nadia Haddad");

  describe("authorization", () => {
    it("signed-out users get 401", async () => {
      as(null);
      expect(await actions.saveMatchRoster({ teamId: ids.ffx, matchId: ids.m204, teamRosterIds: [], finalize: false })).toMatchObject({ ok: false, status: 401 });
    });

    it("players who aren't captains get 403 on every captain write", async () => {
      as("hannah");
      const results = await Promise.all([
        actions.saveMatchRoster({ teamId: ids.ffx, matchId: ids.m204, teamRosterIds: squad(), finalize: false }),
        actions.reopenMatchRoster({ teamId: ids.ffx, matchId: ids.m204 }),
        actions.saveLineup({ teamId: ids.ffx, matchId: ids.m204, formation: "4-4-2", slots: {} }),
        actions.setLineupRole({ teamId: ids.ffx, teamRosterId: roster["Jen Park"], role: "Bench" }),
        actions.sendTeamUpdate({ teamId: ids.ffx, message: "Hi team" }),
        actions.saveMatchReport({ teamId: ids.ffx, matchId: ids.m203, homeScore: 0, awayScore: 2, stats: [], submit: false }),
        actions.setAvailability({ teamId: ids.ffx, matchId: ids.m204, teamRosterId: roster["Jen Park"], status: "UNAVAILABLE" }),
      ]);
      for (const r of results) expect(r).toMatchObject({ ok: false, status: 403 });
    });

    it("players can set their own availability", async () => {
      as("hannah");
      expect(await actions.setAvailability({ teamId: ids.ffx, matchId: ids.m204, status: "AVAILABLE" })).toMatchObject({ ok: true });
    });

    it("captains of one team get 403 on another team", async () => {
      as("maya");
      expect(await actions.saveMatchRoster({ teamId: ids.alx, matchId: ids.m204, teamRosterIds: [], finalize: false })).toMatchObject({ ok: false, status: 403 });
    });
  });

  describe("match roster rules", () => {
    it("blocks suspended players", async () => {
      as("maya");
      const res = await actions.saveMatchRoster({ teamId: ids.ffx, matchId: ids.m204, teamRosterIds: [...squad(), roster["Carmen Vega"]], finalize: false });
      expect(res).toMatchObject({ ok: false, status: 400, error: "Carmen Vega is suspended and can’t play." });
    });

    it("only allows game-pass players for the match their pass covers", async () => {
      as("maya");
      expect(await actions.saveMatchRoster({ teamId: ids.ffx, matchId: ids.m209, teamRosterIds: [...squad(), roster["Jordan Lee"]], finalize: false })).toMatchObject({
        ok: false,
        status: 400,
      });
      expect(await actions.saveMatchRoster({ teamId: ids.ffx, matchId: ids.m204, teamRosterIds: [...squad(), roster["Jordan Lee"]], finalize: false })).toMatchObject({ ok: true });
    });

    it("limits the roster to maxMatchRoster", async () => {
      as("maya");
      const season = await prisma.season.findFirstOrThrow({ where: { isActive: true } });
      const settings = await prisma.leagueSettings.findUniqueOrThrow({ where: { seasonId: season.id } });
      await prisma.leagueSettings.update({ where: { id: settings.id }, data: { maxMatchRoster: 10 } });
      try {
        const res = await actions.saveMatchRoster({ teamId: ids.ffx, matchId: ids.m204, teamRosterIds: squad(), finalize: false });
        expect(res).toMatchObject({ ok: false, status: 400, error: "A match roster can have at most 10 players. Remove 2." });
      } finally {
        await prisma.leagueSettings.update({ where: { id: settings.id }, data: { maxMatchRoster: settings.maxMatchRoster } });
      }
    });

    it("warns about unavailable players but saves", async () => {
      as("maya");
      const res = await actions.saveMatchRoster({ teamId: ids.ffx, matchId: ids.m204, teamRosterIds: [...squad(), roster["Lily Tran"]], finalize: false });
      expect(res).toMatchObject({ ok: true, warnings: ["Lily Tran said they can’t make it."] });
    });

    it("needs a goalkeeper to finalize", async () => {
      as("maya");
      const noKeeper = squad().filter((id) => id !== roster["Priya Raman"]);
      expect(await actions.saveMatchRoster({ teamId: ids.ffx, matchId: ids.m204, teamRosterIds: noKeeper, finalize: true })).toMatchObject({
        ok: false,
        error: "Pick at least one goalkeeper.",
      });
    });

    it("finalizes, locks, and reopens", async () => {
      as("maya");
      expect(await actions.saveMatchRoster({ teamId: ids.ffx, matchId: ids.m204, teamRosterIds: squad(), finalize: true })).toMatchObject({ ok: true });
      expect(await actions.saveMatchRoster({ teamId: ids.ffx, matchId: ids.m204, teamRosterIds: squad(), finalize: false })).toMatchObject({ ok: false, status: 409 });
      const roster204 = await prisma.matchRoster.findUniqueOrThrow({ where: { matchId_teamId: { matchId: ids.m204, teamId: ids.ffx } }, include: { entries: true } });
      expect(roster204.status).toBe("FINALIZED");
      expect(roster204.entries).toHaveLength(12);
    });
  });

  describe("lineup", () => {
    it("only places finalized-roster players", async () => {
      as("maya");
      const bad = await actions.saveLineup({ teamId: ids.ffx, matchId: ids.m204, formation: "4-4-2", slots: { GK: roster["Megan Shaw"] } });
      expect(bad).toMatchObject({ ok: false, status: 400, error: "The player in GK isn’t on the finalized match roster." });
      const ok = await actions.saveLineup({ teamId: ids.ffx, matchId: ids.m204, formation: "4-3-3", slots: { GK: roster["Priya Raman"], ST: roster["Maya Johnson"] } });
      expect(ok).toMatchObject({ ok: true });
      const entry = await prisma.matchRosterEntry.findFirstOrThrow({ where: { teamRosterId: roster["Maya Johnson"], matchRoster: { matchId: ids.m204 } } });
      expect(entry.lineupSlot).toBe("ST");
    });

    it("reopening returns the roster to draft", async () => {
      as("maya");
      expect(await actions.reopenMatchRoster({ teamId: ids.ffx, matchId: ids.m204 })).toMatchObject({ ok: true });
      expect(await actions.saveLineup({ teamId: ids.ffx, matchId: ids.m204, formation: "4-4-2", slots: {} })).toMatchObject({ ok: false, status: 409 });
    });
  });

  describe("match report", () => {
    const player = async (first: string) => (await prisma.player.findFirstOrThrow({ where: { firstName: first, teamMemberships: { some: { teamId: ids.ffx } } } })).id;

    it("requires player goals to equal the team score and a note for reds", async () => {
      as("maya");
      const [maya, nadia, carmen] = [await player("Maya"), await player("Nadia"), await player("Carmen")];
      const base = { teamId: ids.ffx, matchId: ids.m203, homeScore: 0, awayScore: 2, submit: true };
      expect(await actions.saveMatchReport({ ...base, stats: [{ playerId: maya, goals: 1, assists: 0 }] })).toMatchObject({
        ok: false,
        error: "Player goals add up to 1, but your team scored 2.",
      });
      const withRed = [
        { playerId: maya, goals: 1, assists: 0 },
        { playerId: nadia, goals: 1, assists: 0 },
        { playerId: carmen, goals: 0, assists: 0, card: "r" as const },
      ];
      expect(await actions.saveMatchReport({ ...base, stats: withRed })).toMatchObject({ ok: false, error: "Describe what happened with the red card." });
      // Drafts save without the submit checks
      expect(await actions.saveMatchReport({ ...base, submit: false, stats: [] })).toMatchObject({ ok: true });
      expect(await actions.saveMatchReport({ ...base, stats: withRed, redCardNote: "Straight red, 71st minute." })).toMatchObject({ ok: true });
      const match = await prisma.match.findUniqueOrThrow({ where: { id: ids.m203 } });
      expect(match.reportStatus).toBe("SUBMITTED");
    });

    it("locks after submit", async () => {
      as("maya");
      expect(await actions.saveMatchReport({ teamId: ids.ffx, matchId: ids.m203, homeScore: 0, awayScore: 2, stats: [], submit: false })).toMatchObject({ ok: false, status: 409 });
    });

    it("isn't open before kickoff", async () => {
      as("maya");
      expect(await actions.saveMatchReport({ teamId: ids.ffx, matchId: ids.m204, homeScore: 0, awayScore: 0, stats: [], submit: false })).toMatchObject({ ok: false, status: 409 });
    });
  });

  it("admins can act on any team", async () => {
    as("admin");
    expect(await actions.setLineupRole({ teamId: ids.alx, teamRosterId: (await prisma.teamRoster.findFirstOrThrow({ where: { teamId: ids.alx } })).id, role: "Bench" })).toMatchObject({
      ok: true,
    });
  });
});
