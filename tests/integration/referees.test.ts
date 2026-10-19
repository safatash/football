import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auth, hasDb, type TestUser } from "./setup";
import { NVASA_ORG_ID, playerInOrg } from "@/lib/org";

describe.skipIf(!hasDb)("referees and match officials (database)", async () => {
  // NVASA's rows, through the league-scoped client (the Demo League shares names with NVASA)
  const prisma = (await import("@/platform/db")).clientForOrg("org_nvasa");
  const r = await import("@/lib/actions/referees");
  const q = await import("@/lib/queries/referees");
  const { demoSummary } = await import("@/lib/demo");

  let office: TestUser = null;
  let maya: TestUser = null;
  const as = (u: TestUser) => (auth.user = u);
  const ids = {} as Record<string, string>;
  const games = [200, 201, 204, 206, 207, 209];
  let saved: { matchId: string; role: "CENTER" | "AR1" | "AR2" | "FOURTH"; refereeId: string; status: "ASSIGNED" | "CONFIRMED" | "DECLINED" | "NO_SHOW" }[] = [];

  const crew = async (game: number) => {
    const m = await prisma.match.findUniqueOrThrow({ where: { seasonId_gameNumber: { seasonId: ids.season, gameNumber: game } }, include: { officials: { include: { referee: true } } } });
    return m;
  };
  const refId = async (name: string) => (await prisma.referee.findFirstOrThrow({ where: { name } })).id;

  beforeAll(async () => {
    const season = await prisma.season.findFirstOrThrow({ where: { isActive: true } });
    ids.season = season.id;
    ids.wp = (await prisma.division.findUniqueOrThrow({ where: { seasonId_code: { seasonId: season.id, code: "wp" } } })).id;
    const a = await prisma.user.findUniqueOrThrow({ where: { email: "safatash@gmail.com" } });
    office = { id: a.id, email: a.email, name: "Office", isAdmin: true };
    const m = await prisma.user.findUniqueOrThrow({ where: { email: "maya.johnson@example.com" }, include: { players: playerInOrg(NVASA_ORG_ID) } });
    maya = { id: m.id, email: m.email, name: "Maya", playerId: m.players[0]!.id };
    const matches = await prisma.match.findMany({ where: { seasonId: season.id, gameNumber: { in: games } }, include: { officials: true } });
    saved = matches.flatMap((x) => x.officials.map((o) => ({ matchId: o.matchId, role: o.role, refereeId: o.refereeId, status: o.status })));
    await prisma.referee.deleteMany({ where: { name: { startsWith: "Itest" }, assignments: { none: {} } } });
  });

  afterAll(async () => {
    const matchIds = (await prisma.match.findMany({ where: { seasonId: ids.season, gameNumber: { in: games } }, select: { id: true } })).map((x) => x.id);
    await prisma.matchOfficial.deleteMany({ where: { matchId: { in: matchIds } } });
    await prisma.matchOfficial.createMany({ data: saved });
    await prisma.referee.deleteMany({ where: { name: { startsWith: "Itest" } } });
    await prisma.division.update({ where: { id: ids.wp }, data: { centerRefFee: null, assistantRefFee: null, fourthRefFee: null } });
  });

  it("the old ref1/ref2/ref3 names became demo referees with assignments", async () => {
    const m204 = await crew(204);
    expect(m204.officials.map((o) => [o.role, o.referee.name]).sort()).toEqual([
      ["AR1", "Lucia Fernandes"],
      ["AR2", "Omar Haddad"],
      ["CENTER", "Daniel Kim"],
    ]);
    expect((await demoSummary()).referees).toBe(10);
  });

  it("only the league office can manage referees", async () => {
    as(maya);
    expect(await r.createReferee({ name: "Itest Nope", positions: ["CENTER"] })).toMatchObject({ ok: false, status: 403 });
    expect(await r.setMatchOfficials({ matchId: (await crew(209)).id, crew: [] })).toMatchObject({ ok: false, status: 403 });
  });

  it("adds referees with unique names; inactive ones can't be assigned; one role each", async () => {
    as(office);
    expect(await r.createReferee({ name: "Itest Ref", email: "bad", positions: ["CENTER"] })).toMatchObject({ ok: false, status: 400 });
    const made = await r.createReferee({ name: "Itest Ref", email: "itest.ref@nvasa.test", certLevel: "USSF Grade 8", certExpires: "2026-06-01", positions: ["CENTER", "ASSISTANT"], active: false });
    expect(made).toMatchObject({ ok: true });
    ids.itest = made.ok ? made.data!.id : "";
    expect(await r.createReferee({ name: "itest ref", positions: ["CENTER"] })).toMatchObject({ ok: false, status: 409 });
    const m209 = await crew(209);
    expect(await r.setMatchOfficials({ matchId: m209.id, crew: [{ role: "CENTER", refereeId: ids.itest }] })).toMatchObject({ ok: false, status: 400, error: expect.stringMatching(/inactive/) });
    const dk = await refId("Daniel Kim");
    expect(await r.setMatchOfficials({ matchId: m209.id, crew: [{ role: "CENTER", refereeId: dk }, { role: "AR1", refereeId: dk }] })).toMatchObject({ ok: false, status: 400 });
    // Listed with its certification flagged (expires within 30 days of May 16)
    const listed = (await q.listReferees(ids.season)).find((x) => x.id === ids.itest)!;
    expect(listed).toMatchObject({ cert: "expiring", active: false, season: 0 });
  });

  it("warns about overlapping matches and other parks the same day, and saves when forced", async () => {
    as(office);
    // Paul Grant is center on Game #201 at 1 pm May 10 (Chinquapin); #200 kicks off at the same time at Baron Cameron
    const m200 = await crew(200);
    const pg = await refId("Paul Grant");
    const warned = await r.setMatchOfficials({ matchId: m200.id, crew: [{ role: "AR2", refereeId: pg }] });
    expect(warned).toMatchObject({ ok: false, status: 409 });
    if (!warned.ok) expect(warned.errors).toEqual(["Paul Grant is already on Game #201 at an overlapping time."]);
    // Daniel Kim works Wakefield Park on May 17; #207 is at Lee District that afternoon
    const m207 = await crew(207);
    const dk = await refId("Daniel Kim");
    const elsewhere = await r.setMatchOfficials({ matchId: m207.id, crew: [{ role: "AR2", refereeId: dk }] });
    if (!elsewhere.ok) expect(elsewhere.errors).toEqual([expect.stringMatching(/Daniel Kim is at Wakefield Park that day/)]);
    expect(elsewhere).toMatchObject({ ok: false, status: 409 });
    // Same park later that day is fine
    const m206 = await crew(206);
    expect(await r.setMatchOfficials({ matchId: m206.id, crew: [{ role: "FOURTH", refereeId: dk }] })).toMatchObject({ ok: true });
    expect(await r.setMatchOfficials({ matchId: m200.id, crew: [{ role: "AR2", refereeId: pg }], force: true })).toMatchObject({ ok: true });
  });

  it("pays from the division's default fee per role, with match overrides and a paid toggle", async () => {
    as(office);
    expect(await r.saveRefereeFees({ seasonId: ids.season, divisions: [{ id: ids.wp, center: 40, assistant: 25 }] })).toMatchObject({ ok: true });
    const m204 = await crew(204);
    const lucia = m204.officials.find((o) => o.role === "AR1")!.refereeId;
    expect(
      await r.setMatchOfficials({
        matchId: m204.id,
        crew: m204.officials.map((o) => ({ role: o.role, refereeId: o.refereeId, status: o.status, fee: o.role === "AR1" ? 30 : null })),
      }),
    ).toMatchObject({ ok: true });
    const report = await q.payReport("2026-05-17", "2026-05-17");
    const dk = report.find((x) => x.name === "Daniel Kim")!;
    const line = dk.lines.find((l) => l.gameNumber === 204)!;
    expect(line).toMatchObject({ role: "Center", fee: 40, paid: false });
    expect(report.find((x) => x.id === lucia)!.lines.find((l) => l.gameNumber === 204)).toMatchObject({ fee: 30 });
    expect(await r.setOfficialsPaid({ ids: [line.id], paid: true })).toMatchObject({ ok: true });
    const after = (await q.payReport("2026-05-17", "2026-05-17")).find((x) => x.name === "Daniel Kim")!;
    expect(after.paid).toBeGreaterThanOrEqual(40);
    const detail = (await q.getReferee(dk.id, ids.season))!;
    expect(detail.totals.paid).toBeGreaterThanOrEqual(40);
  });

  it("shows open crew slots on the board and the dashboard; referees with assignments can't be deleted", async () => {
    as(office);
    const board = await q.assignmentsBoard("2026-05-18", true);
    expect(board.days.flatMap((d) => d.matches.map((m) => m.gameNumber))).toEqual(expect.arrayContaining([209, 210]));
    expect((await q.crewGaps(ids.season)).map((m) => m.gameNumber)).toEqual(expect.arrayContaining([209, 210]));
    expect(await r.deleteReferee({ id: await refId("Daniel Kim") })).toMatchObject({ ok: false, status: 409, error: expect.stringMatching(/Set them to inactive instead/) });
    expect(await r.deleteReferee({ id: ids.itest })).toMatchObject({ ok: true });
  });

  it("emails each referee with an email address their week", async () => {
    as(office);
    const res = await r.emailWeekAssignments({ weekStart: "2026-05-11" });
    expect(res).toMatchObject({ ok: true, data: { sent: 0 } });
    if (res.ok) expect(res.data!.skipped).toEqual(expect.arrayContaining(["Daniel Kim"]));
  });
});
