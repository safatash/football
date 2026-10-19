/**
 * Authorization without a database: Prisma is stubbed so these always run with `npm test`.
 * (tests/integration repeats them against a seeded database when TEST_DATABASE_URL is set.)
 */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "./integration/setup";

const db = vi.hoisted(() => {
  const team = { id: "team-ffx", seasonId: "s26", name: "Fairfax United", code: "ffx", shortName: "FU", color: "#0F3D2E", homeField: null, maxPlayers: 22, division: { id: "d", code: "wp", name: "Women Premier" } };
  const fail = () => {
    throw new Error("authorization should stop before this query");
  };
  return {
    team,
    membership: null as null | { isCaptain: boolean; membershipType: string },
    role: "PLAYER",
    client: {
      user: { findUnique: async () => ({ id: "u1", email: "player@example.com", role: db.role }) },
      team: { findUnique: async () => team },
      teamRoster: { findFirst: async () => db.membership, findMany: fail, update: fail, create: fail },
      registration: { findUnique: fail, updateMany: fail, update: fail },
      match: { findFirst: fail, findUnique: fail, update: fail },
      matchRoster: { findUnique: fail, create: fail, update: fail, updateMany: fail },
      matchReport: { findUnique: fail, upsert: fail, update: fail },
      leagueSettings: { upsert: fail },
      division: { findMany: fail, update: fail },
      discountCode: { create: fail, findUnique: fail },
      blocklist: { create: fail, findUnique: fail, deleteMany: fail },
      allowedZipCode: { create: fail, findUnique: fail },
      suspension: { create: fail },
      player: { update: fail, findUnique: fail },
      captainRequest: { findUnique: fail },
      $transaction: fail,
    },
  };
});
vi.mock("@/lib/prisma", () => ({ default: db.client }));

const captain = await import("@/lib/actions/captain");
const admin = await import("@/lib/actions/admin");
const structure = await import("@/lib/actions/admin-structure");
const demo = await import("@/lib/actions/demo");
const billing = await import("@/lib/actions/billing");
const approve = await import("@/app/api/admin/registrations/[id]/approve/route");
const deny = await import("@/app/api/admin/registrations/[id]/deny/route");

const player = { id: "u1", email: "player@example.com", name: "Pat Player", playerId: "p1", isAdmin: false };
type Handler = (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
const post = (handler: Handler, body: unknown) =>
  handler(new NextRequest("http://localhost/api/admin/registrations/r1", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ id: "r1" }) });

describe("captain actions", () => {
  beforeEach(() => {
    auth.user = player;
    db.membership = { isCaptain: false, membershipType: "SEASONAL" };
  });

  const writes = () => [
    captain.saveMatchRoster({ teamId: "team-ffx", matchId: "m1", teamRosterIds: [], finalize: true }),
    captain.reopenMatchRoster({ teamId: "team-ffx", matchId: "m1" }),
    captain.saveLineup({ teamId: "team-ffx", matchId: "m1", formation: "4-4-2", slots: {} }),
    captain.setLineupRole({ teamId: "team-ffx", teamRosterId: "tr1", role: "Bench" }),
    captain.sendTeamUpdate({ teamId: "team-ffx", message: "Hi" }),
    captain.saveMatchReport({ teamId: "team-ffx", matchId: "m1", homeScore: 1, awayScore: 0, stats: [], submit: true }),
  ];

  it("a player on the team gets 403 from every captain write", async () => {
    for (const r of await Promise.all(writes())) expect(r).toMatchObject({ ok: false, status: 403 });
  });

  it("someone not on the team gets 403", async () => {
    db.membership = null;
    for (const r of await Promise.all(writes())) expect(r).toMatchObject({ ok: false, status: 403 });
  });

  it("a game-pass player is not a captain, even if flagged", async () => {
    db.membership = { isCaptain: true, membershipType: "GAME_PASS" };
    expect(await captain.sendTeamUpdate({ teamId: "team-ffx", message: "Hi" })).toMatchObject({ ok: false, status: 403 });
  });

  it("signed out gets 401", async () => {
    auth.user = null;
    for (const r of await Promise.all(writes())) expect(r).toMatchObject({ ok: false, status: 401 });
  });
});

describe("admin actions and API routes", () => {
  beforeEach(() => {
    auth.user = player;
    db.role = "PLAYER";
  });

  it("non-admins get 403 from admin server actions", async () => {
    const results = await Promise.all([
      admin.saveSettings({ seasonId: "s26", divisions: [], gamePassFee: 15, fairfaxCountyAllowed: true }),
      admin.createDiscountCode({ seasonId: "s26", code: "FREE", kind: "PROMO", type: "PERCENT", value: 100 }),
      admin.addBlock({ entry: "spam.example" }),
      admin.addAllowedZip({ zip: "22999" }),
      admin.suspendPlayer({ playerId: "p2", reason: "Conduct", until: null }),
      admin.liftSuspension({ playerId: "p2" }),
      admin.setCaptain({ playerId: "p2", teamId: "team-ffx", isCaptain: true }),
      admin.decideCaptainRequest({ requestId: "c1", approve: true }),
      admin.assignPlacement({ registrationId: "r1", teamId: "team-ffx" }),
      admin.setOfficials({ matchId: "m1", refs: ["A", "", ""] }),
      admin.confirmReport({ matchId: "m1", teamId: "team-ffx" }),
      admin.reopenRegistration({ registrationId: "r1" }),
      admin.createPlayerAccount({ firstName: "New", lastName: "Player", email: "new@example.com", dob: "1990-01-01", gender: "FEMALE", phone: "703-555-0101", zip: "" }),
      billing.recordPayment({ registrationId: "r1", amount: 50, method: "CHECK", paidOn: "2026-05-10" }),
      billing.sendPaymentLink({ registrationId: "r1" }),
      billing.waiveBalance({ registrationId: "r1", reason: "Board member" }),
      billing.refundPayment({ registrationId: "r1", amount: 10, reason: "Overpaid" }),
      billing.applyDiscountCode({ registrationId: "r1", code: "SPRING10" }),
      admin.addPlayerToTeam({ playerId: "p2", teamId: "team-ffx" }),
      admin.removePlayerFromTeam({ playerId: "p2", teamId: "team-ffx" }),
      admin.setLeagueOfficeAccess({ email: "player@example.com", admin: true }),
      structure.createSeason({ name: "Fall 2026", startDate: "2026-09-06", endDate: "2026-11-22" }),
      structure.updateSeason({ id: "s26", name: "Spring 2026", startDate: "2026-03-29", endDate: "2026-06-28", makeActive: true }),
      structure.createDivision({ seasonId: "s26", name: "New", fee: 50, genderRule: "COED", minAge: 18 }),
      structure.updateDivision({ id: "d", seasonId: "s26", name: "New", fee: 50, genderRule: "COED", minAge: 18 }),
      structure.deleteDivision({ id: "d" }),
      structure.copyDivisions({ fromSeasonId: "s25", toSeasonId: "s26" }),
      structure.createTeam({ seasonId: "s26", divisionId: "d", name: "Itest FC", status: "ACTIVE" }),
      structure.updateTeam({ id: "team-ffx", divisionId: "d", name: "Fairfax United", status: "ACTIVE" }),
      structure.deleteTeam({ id: "team-ffx" }),
      structure.setJerseyNumber({ playerId: "p2", teamId: "team-ffx", jerseyNumber: 7 }),
      structure.createMatch({ seasonId: "s26", divisionId: "d", homeTeamId: "a", awayTeamId: "b", date: "2026-05-31", time: "09:00", status: "SCHEDULED" }),
      structure.updateMatch({ id: "m1", seasonId: "s26", divisionId: "d", homeTeamId: "a", awayTeamId: "b", date: "2026-05-31", time: "09:00", status: "SCHEDULED" }),
      structure.deleteMatch({ id: "m1" }),
      demo.clearDemoData({ confirm: "clear demo data" }),
    ]);
    for (const r of results) expect(r).toMatchObject({ ok: false, status: 403 });
  });

  it("non-admins get 403 from the approve and deny routes", async () => {
    expect((await post(approve.POST, { teamId: "team-ffx", makeCaptain: true })).status).toBe(403);
    expect((await post(deny.POST, { reason: "Other" })).status).toBe(403);
  });

  it("signed out gets 401", async () => {
    auth.user = null;
    expect(await admin.addBlock({ entry: "spam.example" })).toMatchObject({ ok: false, status: 401 });
    expect((await post(approve.POST, {})).status).toBe(401);
  });

  it("a forged isAdmin flag isn't enough for server actions: the role is re-read", async () => {
    auth.user = { ...player, isAdmin: true };
    db.role = "PLAYER";
    expect(await admin.addBlock({ entry: "spam.example" })).toMatchObject({ ok: false, status: 403 });
  });
});
