import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auth, hasDb, type TestUser } from "./setup";

describe.skipIf(!hasDb)("seasons, divisions, teams and matches (database)", async () => {
  const { default: prisma } = await import("@/lib/prisma");
  const s = await import("@/lib/actions/admin-structure");
  const { loadStandings } = await import("@/lib/queries/standings");

  const ids = {} as Record<string, string>;
  let admin: TestUser = null;
  let maya: TestUser = null;
  const as = (u: TestUser) => (auth.user = u);

  async function cleanup() {
    const seasons = await prisma.season.findMany({ where: { name: { startsWith: "Itest" } }, select: { id: true } });
    const sIds = seasons.map((x) => x.id);
    const active = await prisma.season.findFirstOrThrow({ where: { name: "Spring 2026" } });
    const teamWhere = { OR: [{ seasonId: { in: sIds } }, { seasonId: active.id, name: { startsWith: "Itest" } }] };
    const teams = await prisma.team.findMany({ where: teamWhere, select: { id: true } });
    const tIds = teams.map((t) => t.id);
    await prisma.matchReport.deleteMany({ where: { match: { OR: [{ homeTeamId: { in: tIds } }, { awayTeamId: { in: tIds } }] } } });
    await prisma.match.deleteMany({ where: { OR: [{ homeTeamId: { in: tIds } }, { awayTeamId: { in: tIds } }, { seasonId: { in: sIds } }] } });
    await prisma.teamRoster.deleteMany({ where: { teamId: { in: tIds } } });
    await prisma.team.deleteMany({ where: { id: { in: tIds } } });
    await prisma.division.deleteMany({ where: { seasonId: { in: sIds } } });
    await prisma.leagueSettings.deleteMany({ where: { seasonId: { in: sIds } } });
    await prisma.season.deleteMany({ where: { id: { in: sIds } } });
    await prisma.field.deleteMany({ where: { complex: "Itest Park" } });
    // Spring 2026 stays the active season whatever happened
    await prisma.season.updateMany({ where: { id: { not: active.id }, isActive: true }, data: { isActive: false } });
    await prisma.season.update({ where: { id: active.id }, data: { isActive: true } });
  }

  beforeAll(async () => {
    await cleanup();
    const a = await prisma.user.findUniqueOrThrow({ where: { email: "safatash@gmail.com" } });
    admin = { id: a.id, email: a.email, name: "Admin", isAdmin: true };
    const m = await prisma.user.findUniqueOrThrow({ where: { email: "maya.johnson@example.com" }, include: { player: true } });
    maya = { id: m.id, email: m.email, name: "Maya", playerId: m.player!.id };
    const season = await prisma.season.findFirstOrThrow({ where: { name: "Spring 2026" } });
    ids.season = season.id;
    ids.wp = (await prisma.division.findUniqueOrThrow({ where: { seasonId_code: { seasonId: season.id, code: "wp" } } })).id;
    ids.md1 = (await prisma.division.findUniqueOrThrow({ where: { seasonId_code: { seasonId: season.id, code: "md1" } } })).id;
    ids.ffx = (await prisma.team.findFirstOrThrow({ where: { seasonId: season.id, code: "ffx" } })).id;
    ids.nvs = (await prisma.team.findFirstOrThrow({ where: { seasonId: season.id, code: "nvs" } })).id;
    ids.maya = maya.playerId!;
    ids.aisha = (await prisma.player.findFirstOrThrow({ where: { user: { email: "aisha.bello@example.com" } } })).id;
    ids.chris = (await prisma.player.findFirstOrThrow({ where: { user: { email: "calvarez@example.com" } } })).id;
    ids.m204 = (await prisma.match.findUniqueOrThrow({ where: { seasonId_gameNumber: { seasonId: season.id, gameNumber: 204 } } })).id;
  });
  afterAll(cleanup);

  it("non-admins get 403", async () => {
    as(maya);
    expect(await s.createTeam({ seasonId: ids.season, divisionId: ids.wp, name: "Itest Nope", status: "ACTIVE" })).toMatchObject({ ok: false, status: 403 });
  });

  describe("seasons and divisions", () => {
    it("creates an upcoming season that stays editable, and switches the active season only on request", async () => {
      as(admin);
      const res = await s.createSeason({ name: "Itest Fall 2026", startDate: "2026-09-06", endDate: "2026-11-22" });
      expect(res).toMatchObject({ ok: true });
      const created = await prisma.season.findFirstOrThrow({ where: { name: "Itest Fall 2026" }, include: { settings: true } });
      expect(created).toMatchObject({ isActive: false, slug: "itest-fall-2026" });
      expect(created.settings).not.toBeNull();
      ids.fall = created.id;
      expect(await s.createSeason({ name: "itest fall 2026", startDate: "2026-09-06", endDate: "2026-11-22" })).toMatchObject({ ok: false, status: 409 });
      expect(await s.createSeason({ name: "Itest Backwards", startDate: "2026-09-06", endDate: "2026-01-01" })).toMatchObject({ ok: false, status: 400 });
      // The active season can't be switched off directly
      expect(await s.updateSeason({ id: ids.season, name: "Spring 2026", startDate: "2026-03-29", endDate: "2026-06-28", makeActive: false })).toMatchObject({ ok: false, status: 409 });
    });

    it("adds divisions to an upcoming season; seasons that are over are read-only", async () => {
      as(admin);
      const res = await s.createDivision({ seasonId: ids.fall, name: "Itest Women Open", fee: 80, genderRule: "WOMEN", minAge: 18, femaleCutoff: "2008-09-06" });
      expect(res).toMatchObject({ ok: true, data: { code: "itest-women-open" } });
      ids.fallDiv = (await prisma.division.findFirstOrThrow({ where: { seasonId: ids.fall } })).id;
      const over = await prisma.season.findFirstOrThrow({ where: { name: "Fall 2025" } });
      expect(await s.createDivision({ seasonId: over.id, name: "Itest Late", fee: 1, genderRule: "COED", minAge: 18 })).toMatchObject({ ok: false, status: 409 });
    });
  });

  describe("teams", () => {
    it("creates a team with captains, unique names per season", async () => {
      as(admin);
      const res = await s.createTeam({ seasonId: ids.season, divisionId: ids.wp, name: "Itest Rovers", status: "ACTIVE", captainPlayerIds: [ids.aisha] });
      expect(res).toMatchObject({ ok: true });
      ids.rovers = res.ok ? res.data!.id : "";
      const roster = await prisma.teamRoster.findMany({ where: { teamId: ids.rovers } });
      expect(roster).toMatchObject([{ playerId: ids.aisha, isCaptain: true, membershipType: "SEASONAL", leftAt: null }]);
      expect(await s.createTeam({ seasonId: ids.season, divisionId: ids.md1, name: "itest ROVERS", status: "ACTIVE" })).toMatchObject({ ok: false, status: 409 });
      expect(await s.createTeam({ seasonId: ids.season, divisionId: ids.md1, name: "Fairfax United", status: "ACTIVE" })).toMatchObject({ ok: false, status: 409 });
      // The same name is fine in another season
      expect(await s.createTeam({ seasonId: ids.fall, divisionId: ids.fallDiv, name: "Itest Rovers", status: "ACTIVE" })).toMatchObject({ ok: true });
    });

    it("refuses captains who don't fit the division and divisions from another season", async () => {
      as(admin);
      expect(await s.createTeam({ seasonId: ids.season, divisionId: ids.wp, name: "Itest Mixed", status: "ACTIVE", captainPlayerIds: [ids.chris] })).toMatchObject({ ok: false, status: 400, error: expect.stringMatching(/Women only/) });
      expect(await s.createTeam({ seasonId: ids.season, divisionId: ids.fallDiv, name: "Itest Wrong", status: "ACTIVE" })).toMatchObject({ ok: false, status: 400 });
    });

    it("sets jersey numbers without duplicates", async () => {
      as(admin);
      expect(await s.setJerseyNumber({ playerId: ids.aisha, teamId: ids.rovers, jerseyNumber: 7 })).toMatchObject({ ok: true });
      expect(await s.setJerseyNumber({ playerId: ids.maya, teamId: ids.ffx, jerseyNumber: 2 })).toMatchObject({ ok: false, status: 409, error: expect.stringMatching(/#2 is already Hannah Cole/) });
    });
  });

  describe("matches", () => {
    it("checks teams: not the same, both in the division", async () => {
      as(admin);
      const base = { seasonId: ids.season, divisionId: ids.wp, date: "2026-06-07", time: "09:00", status: "SCHEDULED" as const };
      expect(await s.createMatch({ ...base, homeTeamId: ids.rovers, awayTeamId: ids.rovers })).toMatchObject({ ok: false, status: 400, error: "Home and away can’t be the same team." });
      expect(await s.createMatch({ ...base, homeTeamId: ids.rovers, awayTeamId: ids.nvs })).toMatchObject({ ok: false, status: 400, error: "Nova Strikers isn’t in this division." });
      expect(await s.createMatch({ ...base, homeTeamId: ids.rovers, awayTeamId: ids.ffx, status: "COMPLETED" })).toMatchObject({ ok: false, error: "Enter both scores for a completed match." });
    });

    it("warns about clashes and saves when told to", async () => {
      as(admin);
      // Fairfax United already plays Game #204 at 9:00 on May 17
      const clash = { seasonId: ids.season, divisionId: ids.wp, homeTeamId: ids.rovers, awayTeamId: ids.ffx, date: "2026-05-17", time: "09:30", status: "SCHEDULED" as const, newField: { complex: "Itest Park", name: "1", city: "Fairfax" } };
      const warned = await s.createMatch(clash);
      expect(warned).toMatchObject({ ok: false, status: 409 });
      if (!warned.ok) expect(warned.errors).toEqual(["Fairfax United already plays then (Game #204)."]);
      const forced = await s.createMatch({ ...clash, force: true });
      expect(forced).toMatchObject({ ok: true });
      if (forced.ok) ids.clash = forced.data!.id;
      // Same field, same time, different teams: the field is booked
      const field = await prisma.field.findFirstOrThrow({ where: { complex: "Itest Park" } });
      const booked = await s.createMatch({ seasonId: ids.season, divisionId: ids.md1, homeTeamId: ids.nvs, awayTeamId: (await prisma.team.findFirstOrThrow({ where: { seasonId: ids.season, code: "arl" } })).id, date: "2026-05-17", time: "10:00", status: "SCHEDULED", fieldId: field.id });
      expect(booked).toMatchObject({ ok: false, status: 409 });
      if (!booked.ok) expect(booked.errors).toEqual(["Itest Park 1 is already booked then (Game #" + (await prisma.match.findUniqueOrThrow({ where: { id: ids.clash } })).gameNumber + ")."]);
    });

    it("entering a completed score updates the standings", async () => {
      as(admin);
      const res = await s.createMatch({ seasonId: ids.season, divisionId: ids.wp, homeTeamId: ids.rovers, awayTeamId: ids.ffx, date: "2026-05-03", time: "15:00", status: "SCHEDULED" });
      expect(res).toMatchObject({ ok: true });
      const id = res.ok ? res.data!.id : "";
      const before = (await loadStandings(ids.season, ids.wp)).find((r) => r.team.id === ids.rovers)!;
      expect(before).toMatchObject({ played: 0, pts: 0 });
      const m = await prisma.match.findUniqueOrThrow({ where: { id } });
      const done = await s.updateMatch({ id, seasonId: ids.season, divisionId: ids.wp, homeTeamId: ids.rovers, awayTeamId: ids.ffx, date: "2026-05-03", time: "15:00", status: "COMPLETED", homeScore: 3, awayScore: 1, gameNumber: m.gameNumber });
      expect(done).toMatchObject({ ok: true });
      const after = (await loadStandings(ids.season, ids.wp)).find((r) => r.team.id === ids.rovers)!;
      expect(after).toMatchObject({ played: 1, w: 1, pts: 3, gf: 3, ga: 1 });
      expect(await prisma.match.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: "COMPLETED", reportStatus: "CONFIRMED", homeScore: 3 });
      // Cancelling takes it back out of the table
      await s.updateMatch({ id, seasonId: ids.season, divisionId: ids.wp, homeTeamId: ids.rovers, awayTeamId: ids.ffx, date: "2026-05-03", time: "15:00", status: "CANCELLED", gameNumber: m.gameNumber });
      expect((await loadStandings(ids.season, ids.wp)).find((r) => r.team.id === ids.rovers)!.played).toBe(0);
      ids.cancelled = id;
    });

    it("blocks deleting a match with game passes and a team with matches", async () => {
      as(admin);
      expect(await s.deleteMatch({ id: ids.m204 })).toMatchObject({ ok: false, status: 409, error: expect.stringMatching(/game pass.*cancelled instead/) });
      expect(await s.deleteTeam({ id: ids.rovers })).toMatchObject({ ok: false, status: 409, error: expect.stringMatching(/inactive instead/) });
      expect(await s.updateTeam({ id: ids.rovers, divisionId: ids.md1, name: "Itest Rovers", status: "ACTIVE" })).toMatchObject({ ok: false, status: 409 });
      // Inactive works; then delete once its matches are gone
      expect(await s.updateTeam({ id: ids.rovers, divisionId: ids.wp, name: "Itest Rovers", status: "INACTIVE" })).toMatchObject({ ok: true });
      expect(await s.deleteMatch({ id: ids.cancelled })).toMatchObject({ ok: true });
      expect(await s.deleteMatch({ id: ids.clash })).toMatchObject({ ok: true });
      expect(await s.deleteTeam({ id: ids.rovers })).toMatchObject({ ok: true });
      expect(await prisma.team.count({ where: { id: ids.rovers } })).toBe(0);
    });
  });
});
