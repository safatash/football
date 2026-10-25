/**
 * Batch 6 scheduling, as the NVASA office: field availability and team blackouts feed the
 * round-robin generator; CSV import validates every line; forfeits and point adjustments show up
 * in the standings. Everything created here is in July–August 2026 and is removed afterwards.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auth, hasDb, tenant } from "./setup";

describe.skipIf(!hasDb)("scheduling (database)", async () => {
  const prisma = (await import("@/platform/db")).clientForOrg("org_nvasa");
  const s = await import("@/lib/actions/schedule");
  const { standingsByDivision } = await import("@/lib/queries/standings");
  const { easternTime } = await import("@/lib/game-pass");

  const FROM = "2026-07-01";
  const TO = "2026-08-31";
  const ids = {} as Record<"season" | "division" | "f1" | "f2", string>;
  let teams: { id: string; name: string }[] = [];

  async function cleanup() {
    await prisma.match.deleteMany({ where: { scheduledAt: { gte: easternTime(FROM, "00:00"), lte: easternTime(TO, "23:59") } } });
    await prisma.fieldAvailability.deleteMany({});
    await prisma.teamBlackout.deleteMany({ where: { note: "itest" } });
    await prisma.pointAdjustment.deleteMany({ where: { reason: { startsWith: "itest" } } });
  }

  beforeAll(async () => {
    tenant.orgId = "org_nvasa";
    const office = await prisma.user.findUniqueOrThrow({ where: { email: "safatash@gmail.com" } });
    auth.user = { id: office.id, email: office.email, name: "NVASA office", isAdmin: true };
    const season = await prisma.season.findFirstOrThrow({ where: { isActive: true } });
    const divisions = await prisma.division.findMany({ where: { seasonId: season.id }, include: { _count: { select: { teams: true } } } });
    const division = divisions.sort((a, b) => b._count.teams - a._count.teams)[0];
    teams = await prisma.team.findMany({ where: { divisionId: division.id, status: { not: "INACTIVE" } }, select: { id: true, name: true }, orderBy: { name: "asc" } });
    const fields = await prisma.field.findMany({ where: { active: true }, take: 2, orderBy: { name: "asc" } });
    Object.assign(ids, { season: season.id, division: division.id, f1: fields[0].id, f2: fields[1].id });
    await cleanup();
  });
  afterAll(async () => {
    await cleanup();
    auth.user = null;
  });

  const input = (extra: Record<string, unknown> = {}) => ({ seasonId: ids.season, divisionIds: [ids.division], startDate: FROM, endDate: TO, ...extra });

  it("the generator needs field availability first", async () => {
    expect(await s.previewSchedule(input())).toMatchObject({ ok: false, status: 409, error: expect.stringContaining("availability") });
    expect(await s.setFieldAvailability({ fieldId: ids.f1, windows: [{ weekday: 0, start: "09:00", end: "10:00" }] })).toMatchObject({ ok: false, status: 400 });
  });

  it("plans a full round robin on the fields' Sundays, around team blackouts", async () => {
    expect(teams.length).toBeGreaterThanOrEqual(3);
    expect(await s.setFieldAvailability({ fieldId: ids.f1, windows: [{ weekday: 0, start: "09:00", end: "15:00" }] })).toMatchObject({ ok: true });
    expect(await s.setFieldAvailability({ fieldId: ids.f2, windows: [{ weekday: 0, start: "09:00", end: "13:00" }] })).toMatchObject({ ok: true });
    expect(await s.addTeamBlackout({ teamId: teams[0].id, date: "2026-07-05", note: "itest" })).toMatchObject({ ok: true });
    expect(await s.addTeamBlackout({ teamId: teams[0].id, date: "2026-07-05", note: "itest" })).toMatchObject({ ok: false, status: 409 });

    const res = await s.previewSchedule(input());
    expect(res.ok).toBe(true);
    const plan = res.ok ? res.data! : null;
    const n = teams.length;
    expect(plan!.matches.length + plan!.unscheduled.length).toBe((n * (n - 1)) / 2);
    expect(plan!.unscheduled).toEqual([]);
    for (const m of plan!.matches) {
      expect(new Date(`${m.date}T12:00:00Z`).getUTCDay()).toBe(0);
      expect([ids.f1, ids.f2]).toContain(m.fieldId);
    }
    expect(plan!.matches.some((m) => m.date === "2026-07-05" && [m.homeTeamId, m.awayTeamId].includes(teams[0].id))).toBe(false);
  });

  it("creates the planned matches with new game numbers", async () => {
    const before = await prisma.match.findFirstOrThrow({ where: { seasonId: ids.season }, orderBy: { gameNumber: "desc" } });
    const res = await s.createSchedule(input());
    expect(res).toMatchObject({ ok: true });
    const created = await prisma.match.findMany({ where: { scheduledAt: { gte: easternTime(FROM, "00:00"), lte: easternTime(TO, "23:59") } }, orderBy: { gameNumber: "asc" } });
    expect(created.length).toBe(res.ok ? res.data!.created : -1);
    expect(created[0].gameNumber).toBe(before.gameNumber + 1);
    expect(created.every((m) => m.status === "SCHEDULED" && m.divisionId === ids.division && m.fieldId)).toBe(true);
    // Run again: everything already has a slot, so the second plan works around the first
    const again = await s.previewSchedule(input());
    expect(again.ok && again.data!.notes.join(" ")).toMatch(/already have/);
  });

  it("never plans matches in the past", async () => {
    // The tests run as of May 16, 2026 (NVASA_NOW)
    const res = await s.previewSchedule(input({ startDate: "2026-04-01", endDate: "2026-05-20" }));
    expect(res.ok && res.data!.notes.join(" ")).toMatch(/Starts today \(2026-05-16\)/);
    expect(res.ok && res.data!.matches.every((m) => m.date >= "2026-05-16")).toBe(true);
  });

  it("CSV import: every line is checked before anything is saved", async () => {
    const field = await prisma.field.findUniqueOrThrow({ where: { id: ids.f1 }, include: { park: true } });
    const good = `${teams[0].name},${teams[1].name},8/30/2026,6:30 pm,${field.park.name} ${field.name}`;
    const bad = `${teams[0].name},Nobody FC,8/30/2026,7:00 pm,`;
    const preview = await s.previewImport({ seasonId: ids.season, csv: `home,away,date,time,field\n${good}\n${bad}` });
    expect(preview).toMatchObject({ ok: true, data: { rows: [{ line: 2, time: "18:30" }], errors: [{ line: 3, message: expect.stringContaining("Nobody FC") }] } });
    expect(await s.importSchedule({ seasonId: ids.season, csv: `home,away,date,time,field\n${good}\n${bad}` })).toMatchObject({ ok: false, status: 400 });
    const res = await s.importSchedule({ seasonId: ids.season, csv: `home,away,date,time,field\n${good}` });
    expect(res).toMatchObject({ ok: true, data: { created: 1 } });
    expect(await prisma.match.count({ where: { homeTeamId: teams[0].id, awayTeamId: teams[1].id, scheduledAt: easternTime("2026-08-30", "18:30") } })).toBe(1);
  });

  it("a forfeit counts as a result, and point adjustments change the table", async () => {
    const match = await prisma.match.findFirstOrThrow({ where: { scheduledAt: easternTime("2026-08-30", "18:30") } });
    const loserId = match.awayTeamId;
    const row = async (teamId: string) => (await standingsByDivision(ids.season)).find((d) => d.division.id === ids.division)!.rows.find((r) => r.team.id === teamId)!;
    const before = await row(match.homeTeamId);
    expect(await s.recordForfeit({ matchId: match.id, forfeitTeamId: loserId })).toMatchObject({ ok: true });
    expect(await prisma.match.findUniqueOrThrow({ where: { id: match.id } })).toMatchObject({ status: "COMPLETED", reportStatus: "CONFIRMED", forfeitTeamId: loserId, homeScore: 3, awayScore: 0 });
    expect(await row(match.homeTeamId)).toMatchObject({ played: before.played + 1, w: before.w + 1, pts: before.pts + 3 });

    const adj = await s.addPointAdjustment({ seasonId: ids.season, teamId: match.homeTeamId, points: -3, reason: "itest ineligible player" });
    expect(adj).toMatchObject({ ok: true });
    expect(await row(match.homeTeamId)).toMatchObject({ adj: -3, pts: before.pts });
    expect(await s.addPointAdjustment({ seasonId: ids.season, teamId: match.homeTeamId, points: 0, reason: "itest zero" })).toMatchObject({ ok: false, status: 400 });
    expect(await s.deletePointAdjustment({ id: adj.ok ? adj.data!.id : "" })).toMatchObject({ ok: true });
    expect(await row(match.homeTeamId)).toMatchObject({ adj: 0, pts: before.pts + 3 });
    expect(await s.recordForfeit({ matchId: match.id, forfeitTeamId: "someone-else" })).toMatchObject({ ok: false, status: 400 });
  });
});
