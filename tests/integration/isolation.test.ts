/**
 * League isolation: working as the Demo League, nothing of NVASA's can be read, listed, changed or
 * deleted — not through the scoped client, not through queries, not through server actions with
 * guessed ids. The Demo League (prisma/seed-demo-league.ts) shares NVASA's season name, team
 * names and one player email on purpose.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auth, hasDb, tenant, type TestUser } from "./setup";

const NVASA = "org_nvasa";
const DEMO = "org_demo";

describe.skipIf(!hasDb)("league isolation (database)", async () => {
  const { default: raw } = await import("@/platform/prisma");
  const { db } = await import("@/lib/db");
  const admin = await import("@/lib/actions/admin");
  const structure = await import("@/lib/actions/admin-structure");
  const billing = await import("@/lib/actions/billing");
  const refs = await import("@/lib/actions/referees");
  const fields = await import("@/lib/actions/fields");
  const captain = await import("@/lib/actions/captain");
  const { getPlayer, listPlayers } = await import("@/lib/queries/players");
  const { listTeams } = await import("@/lib/queries/teams");
  const { getPublicMatch } = await import("@/lib/queries/public");
  const { authOptions } = await import("@/lib/auth");

  /** One of each kind of NVASA row, found with the raw client. */
  const nv = {} as Record<"player" | "user" | "team" | "division" | "season" | "match" | "registration" | "payment" | "referee" | "official" | "park" | "field" | "roster", string>;
  const demo = {} as Record<"season" | "team" | "maya", string>;
  const users = {} as Record<"demoOwner" | "nvasaAdmin" | "maya", TestUser>;

  /** A fingerprint of every NVASA row in every league table; it must not change. */
  async function nvasaFingerprint() {
    const tables = await raw.$queryRawUnsafe<{ table_name: string }[]>(`SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'organizationId' ORDER BY table_name`);
    const out: Record<string, string> = {};
    for (const { table_name } of tables) {
      const [{ h }] = await raw.$queryRawUnsafe<{ h: string | null }[]>(`SELECT md5(string_agg(t::text, ',' ORDER BY t::text)) AS h FROM "${table_name}" t WHERE "organizationId" = '${NVASA}'`);
      out[table_name] = h ?? "";
    }
    return out;
  }
  let before: Record<string, string>;

  beforeAll(async () => {
    const season = await raw.season.findFirstOrThrow({ where: { organizationId: NVASA, isActive: true } });
    const maya = await raw.player.findFirstOrThrow({ where: { organizationId: NVASA, user: { email: "maya.johnson@example.com" } } });
    const team = await raw.team.findFirstOrThrow({ where: { organizationId: NVASA, seasonId: season.id, code: "ffx" } });
    const match = await raw.match.findFirstOrThrow({ where: { organizationId: NVASA, seasonId: season.id, gameNumber: 204 } });
    const reg = await raw.registration.findFirstOrThrow({ where: { organizationId: NVASA, seasonId: season.id } });
    const payment = await raw.payment.findFirstOrThrow({ where: { organizationId: NVASA } });
    const official = await raw.matchOfficial.findFirstOrThrow({ where: { organizationId: NVASA } });
    const field = await raw.field.findFirstOrThrow({ where: { organizationId: NVASA } });
    const roster = await raw.teamRoster.findFirstOrThrow({ where: { organizationId: NVASA, teamId: team.id, leftAt: null } });
    Object.assign(nv, {
      player: maya.id,
      user: maya.userId,
      team: team.id,
      division: team.divisionId,
      season: season.id,
      match: match.id,
      registration: reg.id,
      payment: payment.id,
      referee: official.refereeId,
      official: official.id,
      park: field.parkId,
      field: field.id,
      roster: roster.id,
    });
    const dSeason = await raw.season.findFirstOrThrow({ where: { organizationId: DEMO, isActive: true } });
    demo.season = dSeason.id;
    demo.team = (await raw.team.findFirstOrThrow({ where: { organizationId: DEMO, seasonId: dSeason.id, code: "ffx" } })).id;
    demo.maya = (await raw.player.findFirstOrThrow({ where: { organizationId: DEMO, userId: maya.userId } })).id;

    const owner = await raw.user.findUniqueOrThrow({ where: { email: "demo.office@example.com" } });
    const office = await raw.user.findUniqueOrThrow({ where: { email: "safatash@gmail.com" } });
    users.demoOwner = { id: owner.id, email: owner.email, name: "Demo office", isAdmin: true };
    users.nvasaAdmin = { id: office.id, email: office.email, name: "NVASA office", isAdmin: true };
    users.maya = { id: maya.userId, email: "maya.johnson@example.com", name: "Maya", playerId: demo.maya };

    tenant.orgId = DEMO;
    before = await nvasaFingerprint();
  });
  afterAll(() => {
    tenant.orgId = NVASA;
    auth.user = null;
  });

  it("the two leagues really overlap: same season name, team names and player email", async () => {
    expect(await raw.season.count({ where: { name: "Spring 2026", organizationId: { in: [NVASA, DEMO] } } })).toBe(2);
    expect(await raw.team.count({ where: { name: "Fairfax United", season: { name: "Spring 2026" } } })).toBe(2);
    expect(await raw.player.count({ where: { userId: nv.user } })).toBe(2);
  });

  it("the scoped client can't find NVASA rows by id", async () => {
    expect(await db.player.findUnique({ where: { id: nv.player } })).toBeNull();
    expect(await db.team.findUnique({ where: { id: nv.team } })).toBeNull();
    expect(await db.match.findFirst({ where: { id: nv.match } })).toBeNull();
    expect(await db.registration.findUnique({ where: { id: nv.registration } })).toBeNull();
    expect(await db.payment.findUnique({ where: { id: nv.payment } })).toBeNull();
    expect(await db.referee.findUnique({ where: { id: nv.referee } })).toBeNull();
    expect(await db.field.findUnique({ where: { id: nv.field } })).toBeNull();
    expect(await db.park.findUnique({ where: { id: nv.park } })).toBeNull();
    await expect(db.team.findUniqueOrThrow({ where: { id: nv.team } })).rejects.toThrow();
  });

  it("lists and counts only show the Demo League", async () => {
    for (const rows of [
      await db.player.findMany({ select: { organizationId: true } }),
      await db.team.findMany({ select: { organizationId: true } }),
      await db.match.findMany({ select: { organizationId: true } }),
      await db.registration.findMany({ select: { organizationId: true } }),
      await db.payment.findMany({ select: { organizationId: true } }),
      await db.referee.findMany({ select: { organizationId: true } }),
      await db.field.findMany({ select: { organizationId: true } }),
      await db.park.findMany({ select: { organizationId: true } }),
    ]) {
      expect(rows.length).toBeGreaterThan(0);
      expect(new Set(rows.map((r) => r.organizationId))).toEqual(new Set([DEMO]));
    }
    expect(await db.team.count({ where: { name: "Fairfax United" } })).toBe(1);
    expect(await db.player.count({ where: { user: { email: "maya.johnson@example.com" } } })).toBe(1);
    expect((await db.player.findFirstOrThrow({ where: { user: { email: "maya.johnson@example.com" } } })).id).toBe(demo.maya);
    const agg = await db.payment.aggregate({ _sum: { amount: true } });
    expect(Number(agg._sum.amount)).toBe(80);
  });

  it("the scoped client can't update or delete NVASA rows, even by id", async () => {
    await expect(db.team.update({ where: { id: nv.team }, data: { name: "Hacked" } })).rejects.toThrow();
    await expect(db.player.update({ where: { id: nv.player }, data: { firstName: "Hacked" } })).rejects.toThrow();
    await expect(db.payment.update({ where: { id: nv.payment }, data: { notes: "Hacked" } })).rejects.toThrow();
    await expect(db.referee.delete({ where: { id: nv.referee } })).rejects.toThrow();
    await expect(db.field.delete({ where: { id: nv.field } })).rejects.toThrow();
    expect((await db.match.updateMany({ where: { id: nv.match }, data: { homeScore: 99 } })).count).toBe(0);
    expect((await db.registration.deleteMany({ where: { id: nv.registration } })).count).toBe(0);
    expect((await db.player.updateMany({ data: { city: "Bulk" }, where: { id: { in: [nv.player] } } })).count).toBe(0);
  });

  it("refuses to create rows in another league or link to another league's rows", async () => {
    await expect(db.referee.create({ data: { name: "Sneaky", organizationId: NVASA } })).rejects.toThrow(/another league/);
    // A Demo League roster row pointing at NVASA's player: the composite foreign key rejects it
    await expect(db.teamRoster.create({ data: { playerId: nv.player, teamId: demo.team, divisionId: (await db.team.findUniqueOrThrow({ where: { id: demo.team } })).divisionId } })).rejects.toThrow();
    await expect(db.team.update({ where: { id: demo.team }, data: { organizationId: NVASA } })).rejects.toThrow(/another league/);
  });

  it("queries behind the admin and public pages return nothing for NVASA ids", async () => {
    expect(await getPlayer(nv.player, demo.season)).toBeNull();
    expect(await getPlayer(nv.player, nv.season)).toBeNull();
    expect(await getPublicMatch(nv.match)).toBeNull();
    expect((await listTeams(nv.season)).length).toBe(0);
    expect((await listPlayers(nv.season)).length).toBe(0);
    const names = (await listTeams(demo.season)).map((t) => t.id);
    expect(names).toContain(demo.team);
    expect(names).not.toContain(nv.team);
  });

  it("an NVASA admin has no league-office access in the Demo League", async () => {
    auth.user = users.nvasaAdmin;
    expect(await admin.addAllowedZip({ zip: "22150" })).toMatchObject({ ok: false, status: 403 });
    expect(await refs.createReferee({ name: "Itest Crossover", positions: ["CENTER"] })).toMatchObject({ ok: false, status: 403 });
    expect(await structure.deleteTeam({ id: demo.team })).toMatchObject({ ok: false, status: 403 });
  });

  it("the Demo League office can't change NVASA rows through server actions with guessed ids", async () => {
    auth.user = users.demoOwner;
    const results = {
      suspend: await admin.suspendPlayer({ playerId: nv.player, reason: "Itest isolation" }),
      lift: await admin.liftSuspension({ playerId: nv.player }),
      captain: await admin.setCaptain({ playerId: nv.player, teamId: nv.team, isCaptain: false }),
      removeFromTeam: await admin.removePlayerFromTeam({ playerId: nv.player, teamId: nv.team }),
      reopen: await admin.reopenRegistration({ registrationId: nv.registration }),
      place: await admin.assignPlacement({ registrationId: nv.registration, teamId: demo.team }),
      confirmReport: await admin.confirmReport({ matchId: nv.match, teamId: nv.team }),
      deleteTeam: await structure.deleteTeam({ id: nv.team }),
      deleteMatch: await structure.deleteMatch({ id: nv.match }),
      deleteDivision: await structure.deleteDivision({ id: nv.division }),
      recordPayment: await billing.recordPayment({ registrationId: nv.registration, amount: 5, method: "CASH", paidOn: "2026-05-01" }),
      refund: await billing.refundPayment({ registrationId: nv.registration, amount: 1, reason: "Itest isolation" }),
      waive: await billing.waiveBalance({ registrationId: nv.registration, reason: "Itest isolation" }),
      payLink: await billing.sendPaymentLink({ registrationId: nv.registration }),
      updateReferee: await refs.updateReferee({ id: nv.referee, name: "Hacked Ref", positions: ["CENTER"] }),
      deleteReferee: await refs.deleteReferee({ id: nv.referee }),
      crew: await refs.setMatchOfficials({ matchId: nv.match, crew: [] }),
      updatePark: await fields.updatePark({ id: nv.park, name: "Hacked Park" }),
      deletePark: await fields.deletePark({ id: nv.park }),
      updateField: await fields.updateField({ id: nv.field, parkId: nv.park, name: "Hacked" }),
      deleteField: await fields.deleteField({ id: nv.field }),
    };
    for (const [name, res] of Object.entries(results)) expect(res, name).toMatchObject({ ok: false, status: 404 });
    // Bulk "mark paid" with NVASA ids changes nothing
    await refs.setOfficialsPaid({ ids: [nv.official], paid: true });
  });

  it("a captain in the Demo League has no captain access to NVASA's team of the same name", async () => {
    auth.user = users.maya;
    expect(await captain.setLineupRole({ teamId: nv.team, teamRosterId: nv.roster, role: "Bench" })).toMatchObject({ ok: false });
    expect(await captain.setAvailability({ teamId: nv.team, matchId: nv.match, status: "UNAVAILABLE" })).toMatchObject({ ok: false });
  });

  it("logins are per league: an NVASA-only player can't sign in to the Demo League", async () => {
    const authorize = (authOptions.providers[0] as unknown as { options: { authorize: (c: Record<string, string>) => Promise<unknown> } }).options.authorize;
    await expect(authorize({ email: "hannah.cole@example.com", password: "NvasaPlayer26" })).rejects.toThrow();
    await expect(authorize({ email: "maya.johnson@example.com", password: "MayaJohnson26" })).resolves.toMatchObject({ email: "maya.johnson@example.com", name: "Maya Johnson (Demo)" });
    const session = (await authOptions.callbacks!.session!({ session: { user: { email: "safatash@gmail.com" }, expires: "" }, token: { sub: users.nvasaAdmin!.id } } as never)) as { user: { isAdmin: boolean; playerId?: string } };
    expect(session.user.isAdmin).toBe(false);
  });

  it("none of that changed a single NVASA row", async () => {
    expect(await nvasaFingerprint()).toEqual(before);
  });
});

/**
 * Row-level security (DB_RLS=on, docs/rls.md): the database itself refuses other leagues' rows,
 * even to queries that skip the scoped client's filters. Needs a real Postgres with
 * prisma/rls/rls.sql applied (`npm run db:rls`); PGlite's superuser ignores RLS.
 */
describe.skipIf(!hasDb || process.env.DB_RLS !== "on")("row-level security (database)", async () => {
  const { default: raw, appPrisma } = await import("@/platform/prisma");
  const { db, runWithOrg, leagueTransaction } = await import("@/lib/db");
  const { sendMail } = await import("@/lib/mail");
  const app = appPrisma();

  it("every league table has RLS on with the league policy", async () => {
    const rows = await raw.$queryRaw<{ table_name: string; rls: boolean; policies: bigint }[]>`
      SELECT c.table_name, cl.relrowsecurity AS rls, (SELECT count(*) FROM pg_policies p WHERE p.tablename = c.table_name AND p.policyname = 'league_isolation') AS policies
      FROM information_schema.columns c JOIN pg_class cl ON cl.relname = c.table_name AND cl.relkind = 'r'
      WHERE c.table_schema = 'public' AND c.column_name = 'organizationId'`;
    expect(rows.length).toBeGreaterThan(20);
    for (const r of rows) expect({ table: r.table_name, rls: r.rls, policies: Number(r.policies) }).toEqual({ table: r.table_name, rls: true, policies: 1 });
  });

  it("the scoped client connects as the app role, which can't bypass RLS", async () => {
    const [me] = await runWithOrg(DEMO, () => db.$queryRaw<{ user: string; superuser: boolean; bypass: boolean }[]>`
      SELECT current_user AS user, r.rolsuper AS superuser, r.rolbypassrls AS bypass FROM pg_roles r WHERE r.rolname = current_user`);
    expect(me).toMatchObject({ superuser: false, bypass: false });
    expect(me.user).not.toBe((await raw.$queryRaw<{ u: string }[]>`SELECT current_user AS u`)[0].u);
  });

  it("a raw query without app.org_id returns nothing and can't write", async () => {
    expect(await raw.player.count()).toBeGreaterThan(0);
    const [{ n }] = await app.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM players`;
    expect(Number(n)).toBe(0);
    expect(await app.team.findMany()).toEqual([]);
    expect(await app.payment.findMany({ where: { organizationId: NVASA } })).toEqual([]);
    await expect(app.referee.create({ data: { name: "No league", organizationId: NVASA } })).rejects.toThrow();
    expect((await app.team.updateMany({ data: { name: "Hacked" } })).count).toBe(0);
  });

  it("with app.org_id set, unfiltered raw SQL sees only that league", async () => {
    const [, rows] = await app.$transaction([
      app.$executeRaw`SELECT set_config('app.org_id', ${DEMO}, true)`,
      app.$queryRaw<{ organizationId: string }[]>`SELECT DISTINCT "organizationId" FROM players`,
    ]);
    expect(rows).toEqual([{ organizationId: DEMO }]);
    // SET LOCAL ends with the transaction: the next query on the pool sees nothing again
    expect(Number((await app.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM players`)[0].n)).toBe(0);
  });

  it("a write naming another league fails the policy check, inside a league transaction", async () => {
    await expect(
      app.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.org_id', ${DEMO}, true)`;
        await tx.$executeRaw`INSERT INTO referees (id, "organizationId", name, "updatedAt") VALUES ('itest_rls_ref', ${NVASA}, 'Sneaky', now())`;
      }),
    ).rejects.toThrow(/row-level security/);
    expect(await raw.referee.findUnique({ where: { id: "itest_rls_ref" } })).toBeNull();
  });

  it("db.$transaction carries the league into every query of the callback", async () => {
    const teams = await runWithOrg(DEMO, () => db.$transaction(async (tx) => [await tx.team.count(), await tx.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM teams`]));
    expect(teams[0]).toBeGreaterThan(0);
    expect(Number((teams[1] as { n: bigint }[])[0].n)).toBe(teams[0]);
  });

  const txid = async () => (await db.$queryRaw<{ id: bigint }[]>`SELECT txid_current() AS id`)[0].id;

  it("leagueTransaction (what runAction uses): every db call and db.$transaction joins one transaction", async () => {
    const ids = await runWithOrg(DEMO, () =>
      leagueTransaction(async () => [await txid(), await db.team.count().then(txid), await db.$transaction(() => txid()), ...(await Promise.all([txid(), txid()]))]),
    );
    expect(new Set(ids).size).toBe(1);
    // Outside it, each call is its own transaction again
    expect(await runWithOrg(DEMO, txid)).not.toBe(ids[0]);
  });

  it("an error anywhere in it rolls back every write", async () => {
    await expect(
      runWithOrg(DEMO, () =>
        leagueTransaction(async () => {
          await db.referee.create({ data: { id: "itest_rls_rollback", name: "Rolled back" } });
          throw new Error("boom");
        }),
      ),
    ).rejects.toThrow("boom");
    expect(await raw.referee.findUnique({ where: { id: "itest_rls_rollback" } })).toBeNull();
  });

  it("refuses to send mail inside it (mail goes out after the database work)", async () => {
    await expect(runWithOrg(DEMO, () => leagueTransaction(() => sendMail({ to: "x@example.com", subject: "s", text: "t", html: "<p>t</p>" })))).rejects.toThrow(/league transaction/);
    await expect(runWithOrg(DEMO, () => sendMail({ to: "x@example.com", subject: "s", text: "t", html: "<p>t</p>" }))).resolves.toMatchObject({ failed: 0 });
  });
});
