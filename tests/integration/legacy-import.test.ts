import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hasDb } from "./setup";
import { NVASA_ORG_ID } from "@/lib/org";
import type { LegacyReader } from "@/lib/legacy-import";

const DS = "itestspring2024";

/** A tiny legacy season: 2 divisions, 3 teams, 5 players, 4 games (one broken), stats. */
const fixture: LegacyReader = {
  season: async (ds) => (ds === DS ? { datasource: DS, name: "Itest Spring 2024", startdate: "2024-03-31", enddate: "2024-06-30", activeSite: 0 } : null),
  referees: async () => new Map([[90, "Daniel Kim"], [91, "Lucia Fernandes"], [92, "Omar Haddad"]]),
  divisions: async () => [
    { id: 1, name: "Itest Women Premier", cat: "Competitive", orderit: 1, bbm: null, bbf: "2006-03-31", price: "95" },
    { id: 2, name: "Itest Coed", cat: "Recreational", orderit: 2, bbm: "2006-03-31", bbf: "2006-03-31", price: "55" },
  ],
  fields: async () => [{ id: 7001, complex: "Itest Park", field: "2", address: "1 Test Rd", city: "Fairfax", state: "VA", zip: "22030" }],
  teams: async () => [
    { id: 11, did: 1, name: "Itest Falcons", logo: "falcons.png", htshirt: "rgb(15, 61, 46)", hshort: "rgb(255,255,255)", atshirt: "#ffffff", ashort: "rgb(15,61,46)", formation: "4-4-2" },
    { id: 12, did: 1, name: "Itest Hawks", htshirt: "rgb(122, 31, 43)", formation: "" },
    { id: 13, did: 9, name: "Itest Orphans" }, // division missing → reported, skipped
  ],
  players: async () => [
    { id: 501, first: "Ivy", last: "Testa", email: "ivy.testa@example.com", gender: "Female", position: "FWD", status: 1, dob: "1995-02-03" },
    { id: 502, first: "Bea", last: "Testb", email: "", gender: "Female", position: "GK", status: 2, dob: "1990-07-07" }, // no email, suspended
    { id: 503, first: "Cara", last: "Testc", email: "cara.testc@example.com", gender: "Female", position: "MID", status: 1, dob: null }, // no DOB
    { id: 504, first: "Dee", last: "Testd", email: "dee.testd@example.com", gender: "Female", position: "DEF", status: 1, dob: "1992-01-01" },
    { id: 505, first: "Maya", last: "Johnson", email: "MAYA.JOHNSON@example.com", gender: "Female", position: "FWD", status: 1, dob: "1994-03-12" }, // existing player
  ],
  roster: async () => [
    { pid: 501, tid: 11, captain: 1, finalapproval: 1, jno: 9 },
    { pid: 502, tid: 11, captain: 0, finalapproval: 1, jno: 1 },
    { pid: 503, tid: 12, captain: 0, finalapproval: 1, jno: 8 },
    { pid: 504, tid: 12, captain: 0, finalapproval: 0, jno: 4 }, // not approved → not on the roster
    { pid: 505, tid: 12, captain: 1, finalapproval: 1, jno: 10 },
    { pid: 999, tid: 12, captain: 0, finalapproval: 1, jno: 99 }, // unknown player → reported
  ],
  games: async () => [
    { id: 301, gameno: 7, did: 1, home: 11, away: 12, gamedate: "2024-04-07", gametime: "9:00 AM", location: 7001, scoreHome: "2", scoreAway: "1", ref: 90, refr: 91, refl: 92 },
    { id: 302, gameno: 8, did: 1, home: 12, away: 11, gamedate: "2024-04-14", gametime: "TBD", location: 7001, scoreHome: "0", scoreAway: "0", ref: 0, refr: 0, refl: 0 },
    { id: 303, gameno: 8, did: 1, home: 11, away: 12, gamedate: "2024-06-30", gametime: "11:00 AM", location: 0, scoreHome: "", scoreAway: "" }, // repeated number, not played
    { id: 304, gameno: 9, did: 1, home: 11, away: 77, gamedate: "2024-05-05", gametime: "9:00 AM", location: 7001, scoreHome: "1", scoreAway: "0" }, // unknown team
  ],
  scores: async () => [
    { pid: 501, gid: 301, home: 11, away: 0, goal: 2, assist: 0, yellow: "UB", yellow2: "", red: "", ingame: "In", note: "" },
    { pid: 502, gid: 301, home: 11, away: 0, goal: 0, assist: 0, yellow: "", yellow2: "", red: "", ingame: "In", note: "" },
    { pid: 505, gid: 301, home: 0, away: 12, goal: 1, assist: 0, yellow: "", yellow2: "", red: "", ingame: "Out", note: "" },
    { pid: 503, gid: 301, home: 0, away: 12, goal: 0, assist: 1, yellow: "", yellow2: "", red: "SFP", ingame: "In", note: "Ref note" },
  ],
};

describe.skipIf(!hasDb)("legacy import (database)", async () => {
  // NVASA's rows, through the league-scoped client (the Demo League shares names with NVASA)
  const prisma = (await import("@/platform/db")).clientForOrg("org_nvasa");
  const { importSeason } = await import("@/lib/legacy-import");
  const { loadStandings } = await import("@/lib/queries/standings");
  const { resolveLegacy } = await import("@/lib/legacy-redirects");
  const { legacyDb } = await import("@/lib/legacy-db");

  let mayaKeyBefore: string | null = null;

  async function cleanup() {
    const season = await prisma.season.findFirst({ where: { legacyDatasource: DS } });
    if (season) {
      await prisma.matchReport.deleteMany({ where: { match: { seasonId: season.id } } });
      await prisma.match.deleteMany({ where: { seasonId: season.id } });
      await prisma.teamRoster.deleteMany({ where: { team: { seasonId: season.id } } });
      await prisma.team.deleteMany({ where: { seasonId: season.id } });
      await prisma.season.delete({ where: { id: season.id } });
    }
    await prisma.suspension.deleteMany({ where: { reason: { contains: "Itest Spring 2024" } } });
    await prisma.user.deleteMany({ where: { players: { some: { legacyKey: { in: ["legacy:501", "legacy:502", "legacy:503", "legacy:504"] } } } } });
    await prisma.field.deleteMany({ where: { legacyId: 7001 } });
    await prisma.park.deleteMany({ where: { name: "Itest Park", fields: { none: {} } } });
  }

  beforeAll(async () => {
    await cleanup();
    mayaKeyBefore = (await prisma.player.findFirstOrThrow({ where: { user: { email: "maya.johnson@example.com" } } })).legacyKey;
  });
  afterAll(async () => {
    await cleanup();
    await prisma.player.updateMany({ where: { user: { email: "maya.johnson@example.com" } }, data: { legacyKey: mayaKeyBefore } });
  });

  it("dry run counts and reports problems without writing", async () => {
    const r = await importSeason(fixture, prisma, { datasource: DS, dryRun: true });
    expect(r.counts).toMatchObject({ divisions: 2, teams: 2, players: 5, rosterSpots: 4, matches: 3, results: 2, playerStatLines: 4 });
    expect(r.problems.join("\n")).toMatch(/team 13 "Itest Orphans": division 9 not found/);
    expect(r.problems.join("\n")).toMatch(/game 304 \(#9\): home\/away team not found/);
    expect(r.problems.join("\n")).toMatch(/game 303: game number 8 repeats game 302/);
    expect(r.problems.join("\n")).toMatch(/player 503 "Cara Testc": no date of birth/);
    expect(await prisma.season.count({ where: { legacyDatasource: DS } })).toBe(0);
  });

  it("imports the season, and re-running it changes nothing", async () => {
    await importSeason(fixture, prisma, { datasource: DS, dryRun: false, imageUrl: (kind, f) => `/legacy/${kind}/${f}` });
    const count = async () => ({
      matches: await prisma.match.count({ where: { season: { legacyDatasource: DS } } }),
      roster: await prisma.teamRoster.count({ where: { team: { season: { legacyDatasource: DS } } } }),
      stats: await prisma.playerMatchStat.count({ where: { report: { match: { season: { legacyDatasource: DS } } } } }),
      reports: await prisma.matchReport.count({ where: { match: { season: { legacyDatasource: DS } } } }),
      users: await prisma.user.count(),
    });
    const first = await count();
    await importSeason(fixture, prisma, { datasource: DS, dryRun: false, imageUrl: (kind, f) => `/legacy/${kind}/${f}` });
    expect(await count()).toEqual(first);
    expect(first).toMatchObject({ matches: 3, roster: 4, stats: 4, reports: 4 });
  });

  it("maps seasons, teams, kits and images", async () => {
    const season = await prisma.season.findFirstOrThrow({ where: { legacyDatasource: DS } });
    expect(season).toMatchObject({ slug: "itest-spring-2024", isActive: false });
    const falcons = await prisma.team.findFirstOrThrow({ where: { seasonId: season.id, legacyId: 11 } });
    expect(falcons).toMatchObject({ homeShirt: "#0F3D2E", homeShorts: "#FFFFFF", awayShirt: "#FFFFFF", awayShorts: "#0F3D2E", formation: "4-4-2", logoUrl: "/legacy/teams/falcons.png" });
    const div = await prisma.division.findFirstOrThrow({ where: { seasonId: season.id, legacyId: 1 } });
    expect(div).toMatchObject({ genderRule: "WOMEN", registrationFee: expect.anything() });
    expect(Number(div.registrationFee)).toBe(95);
  });

  it("maps players and roster without importing passwords", async () => {
    const ivy = await prisma.player.findUniqueOrThrow({ where: { organizationId_legacyKey: { organizationId: NVASA_ORG_ID, legacyKey: "legacy:501" } }, include: { user: true, teamMemberships: true } });
    expect(ivy.user.email).toBe("ivy.testa@example.com");
    expect(ivy.teamMemberships).toMatchObject([{ jerseyNumber: 9, isCaptain: true, membershipType: "SEASONAL" }]);
    const bea = await prisma.player.findUniqueOrThrow({ where: { organizationId_legacyKey: { organizationId: NVASA_ORG_ID, legacyKey: "legacy:502" } }, include: { user: true, suspensions: true } });
    expect(bea.user.email).toBe("legacy-player-502@nvasa.invalid");
    expect(bea.suspensions).toHaveLength(1);
    expect(bea.suspensions[0].endsAt?.toISOString().slice(0, 10)).toBe("2024-06-30");
    const cara = await prisma.player.findUniqueOrThrow({ where: { organizationId_legacyKey: { organizationId: NVASA_ORG_ID, legacyKey: "legacy:503" } } });
    expect(cara.dob.toISOString().slice(0, 10)).toBe("1900-01-01");
    // Unapproved roster rows don't become roster spots
    const dee = await prisma.player.findUniqueOrThrow({ where: { organizationId_legacyKey: { organizationId: NVASA_ORG_ID, legacyKey: "legacy:504" } }, include: { teamMemberships: true } });
    expect(dee.teamMemberships).toHaveLength(0);
    // The existing account was adopted by email, not duplicated
    expect(await prisma.user.count({ where: { email: { equals: "maya.johnson@example.com", mode: "insensitive" } } })).toBe(1);
    expect((await prisma.player.findFirstOrThrow({ where: { user: { email: "maya.johnson@example.com" } } })).legacyKey).toBe("legacy:505");
  });

  it("maps games, officials, stats and standings", async () => {
    const season = await prisma.season.findFirstOrThrow({ where: { legacyDatasource: DS } });
    const g7 = await prisma.match.findUniqueOrThrow({ where: { seasonId_legacyId: { seasonId: season.id, legacyId: 301 } }, include: { venue: { include: { park: true } } } });
    expect(g7).toMatchObject({ gameNumber: 7, homeScore: 2, awayScore: 1, status: "COMPLETED", reportStatus: "CONFIRMED" });
    const crew = await prisma.matchOfficial.findMany({ where: { matchId: g7.id }, include: { referee: true }, orderBy: { role: "asc" } });
    expect(crew.map((o) => [o.role, o.referee.name, o.status])).toEqual([
      ["CENTER", "Daniel Kim", "CONFIRMED"],
      ["AR1", "Lucia Fernandes", "CONFIRMED"],
      ["AR2", "Omar Haddad", "CONFIRMED"],
    ]);
    expect(g7.scheduledAt.toISOString()).toBe("2024-04-07T13:00:00.000Z");
    expect(g7.venue).toMatchObject({ name: "2", park: { name: "Itest Park", address: "1 Test Rd", city: "Fairfax", zip: "22030" } });
    const unplayed = await prisma.match.findUniqueOrThrow({ where: { seasonId_legacyId: { seasonId: season.id, legacyId: 303 } } });
    expect(unplayed).toMatchObject({ gameNumber: 100303, status: "SCHEDULED", homeScore: null });
    const cara = await prisma.player.findUniqueOrThrow({ where: { organizationId_legacyKey: { organizationId: NVASA_ORG_ID, legacyKey: "legacy:503" } } });
    const line = await prisma.playerMatchStat.findFirstOrThrow({ where: { playerId: cara.id, report: { matchId: g7.id } } });
    expect(line).toMatchObject({ assists: 1, red: 1, inGame: "IN", note: "Ref note · Cards: R SFP" });

    const div = await prisma.division.findFirstOrThrow({ where: { seasonId: season.id, legacyId: 1 } });
    const table = await loadStandings(season.id, div.id);
    expect(table.map((r) => [r.team.name, r.pts, r.played])).toEqual([
      ["Itest Falcons", 4, 2],
      ["Itest Hawks", 1, 2],
    ]);
  });

  it("old links find the imported rows", async () => {
    const team = await resolveLegacy("team", new URLSearchParams(`id=11&season=${DS}`), legacyDb);
    expect(team).toMatch(/^\/teams\/c[a-z0-9]+\?season=itest-spring-2024$/);
    expect(await resolveLegacy("gamereport", new URLSearchParams(`gid=301&season=${DS}`), legacyDb)).toMatch(/^\/matches\/c[a-z0-9]+$/);
    expect(await resolveLegacy("player", new URLSearchParams("id=501"), legacyDb)).toMatch(/^\/players\/c[a-z0-9]+$/);
  });
});
