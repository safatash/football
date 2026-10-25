"use server";

/**
 * Scheduling for the league office: field availability and team blackout dates (structured, so the
 * generator and a future smart scheduler can use them), the round-robin generator, CSV import,
 * forfeits and point adjustments. Previews and creates recompute everything on the server from the
 * same inputs; nothing the browser sends back is trusted as a match.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { easternTime } from "@/lib/game-pass";
import { now } from "@/lib/clock";
import { TZ, dayKey } from "@/lib/format";
import { assertSeasonWritable } from "@/lib/queries/season";
import { generateSchedule, matchDays, type Window } from "@/lib/round-robin";
import { parseScheduleCsv } from "@/lib/schedule-csv";
import { FIELD_GAP_MINUTES, MATCH_MINUTES, scheduleConflicts, type Slot } from "@/lib/schedule-rules";
import { requireAdminUser } from "./admin-guard";
import { ActionError, runAction, type ActionResult } from "./result";

const Id = z.string().trim().min(1).max(64);
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date.");
const Time = z.string().regex(/^\d{2}:\d{2}$/, "Use a time like 09:00.");
const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
/** Minutes after midnight (league time) of a kickoff. */
const minuteOf = (d: Date) => minutes(d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ }));

function refreshAll() {
  revalidatePath("/", "layout");
}

async function audit(me: { id: string; email: string }, entry: { action: string; entityType: string; entityId: string; summary: string }) {
  await db.auditLog.create({ data: { actorUserId: me.id, actorEmail: me.email, ...entry } });
}

/* ------------------------------------------------------------------ */
/* Field availability and team blackouts                               */
/* ------------------------------------------------------------------ */

const WindowInput = z.object({ weekday: z.number().int().min(0).max(6), start: Time, end: Time });

/** Replaces a field's weekly availability (for every season). */
export async function setFieldAvailability(input: { fieldId: string; windows: z.input<typeof WindowInput>[] }): Promise<ActionResult> {
  return runAction(async () => {
    const fieldId = Id.parse(input.fieldId);
    const windows = z.array(WindowInput).max(28).parse(input.windows);
    const me = await requireAdminUser();
    const field = await db.field.findUnique({ where: { id: fieldId }, include: { park: { select: { name: true } } } });
    if (!field) throw new ActionError("Field not found.", 404);
    for (const w of windows) {
      if (minutes(w.end) - minutes(w.start) < MATCH_MINUTES) throw new ActionError(`Each window needs at least ${MATCH_MINUTES} minutes for a match (${w.start}–${w.end}).`, 400);
    }
    await db.$transaction(async (tx) => {
      await tx.fieldAvailability.deleteMany({ where: { fieldId, seasonId: null } });
      if (windows.length) await tx.fieldAvailability.createMany({ data: windows.map((w) => ({ fieldId, weekday: w.weekday, startMinute: minutes(w.start), endMinute: minutes(w.end) })) });
    });
    await audit(me, { action: "field.availability", entityType: "field", entityId: fieldId, summary: `Set ${field.park.name} ${field.name} availability (${windows.length} window${windows.length === 1 ? "" : "s"})` });
    refreshAll();
    return { ok: true, message: "Availability saved" };
  });
}

export async function addTeamBlackout(input: { teamId: string; date: string; note?: string }): Promise<ActionResult> {
  return runAction(async () => {
    const data = z.object({ teamId: Id, date: IsoDate, note: z.string().trim().max(120).optional() }).parse(input);
    await requireAdminUser();
    const team = await db.team.findUnique({ where: { id: data.teamId }, select: { id: true, name: true, seasonId: true } });
    if (!team) throw new ActionError("Team not found.", 404);
    await assertSeasonWritable(team.seasonId);
    if (await db.teamBlackout.findFirst({ where: { teamId: team.id, date: day(data.date) } })) throw new ActionError(`${team.name} already can’t play that day.`, 409);
    await db.teamBlackout.create({ data: { teamId: team.id, date: day(data.date), note: data.note || null } });
    refreshAll();
    return { ok: true, message: "Blackout date added" };
  });
}

export async function removeTeamBlackout(input: { id: string }): Promise<ActionResult> {
  return runAction(async () => {
    const id = Id.parse(input.id);
    await requireAdminUser();
    const res = await db.teamBlackout.deleteMany({ where: { id } });
    if (!res.count) throw new ActionError("That blackout date is already gone.", 404);
    refreshAll();
    return { ok: true, message: "Blackout date removed" };
  });
}

/* ------------------------------------------------------------------ */
/* Forfeits and point adjustments                                      */
/* ------------------------------------------------------------------ */

/** Records a forfeit: the other team wins forfeitGoals–0, and the result counts in the standings. */
export async function recordForfeit(input: { matchId: string; forfeitTeamId: string }): Promise<ActionResult> {
  return runAction(async () => {
    const data = z.object({ matchId: Id, forfeitTeamId: Id }).parse(input);
    const me = await requireAdminUser();
    const match = await db.match.findUnique({ where: { id: data.matchId }, include: { homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } } });
    if (!match) throw new ActionError("Match not found.", 404);
    await assertSeasonWritable(match.seasonId);
    if (data.forfeitTeamId !== match.homeTeamId && data.forfeitTeamId !== match.awayTeamId) throw new ActionError("Pick one of the two teams.", 400);
    if (match.status === "CANCELLED") throw new ActionError("This match is cancelled. Set it back to scheduled first.", 409);
    const goals = (await db.organizationSettings.findFirst({ select: { forfeitGoals: true } }))?.forfeitGoals ?? 3;
    const homeForfeits = data.forfeitTeamId === match.homeTeamId;
    await db.match.update({
      where: { id: match.id },
      data: { status: "COMPLETED", reportStatus: "CONFIRMED", forfeitTeamId: data.forfeitTeamId, homeScore: homeForfeits ? 0 : goals, awayScore: homeForfeits ? goals : 0 },
    });
    const loser = homeForfeits ? match.homeTeam.name : match.awayTeam.name;
    await audit(me, { action: "match.forfeit", entityType: "match", entityId: match.id, summary: `Game #${match.gameNumber}: ${loser} forfeited (${homeForfeits ? `0–${goals}` : `${goals}–0`})` });
    refreshAll();
    return { ok: true, message: `Game #${match.gameNumber}: ${loser} forfeited` };
  });
}

const AdjustmentInput = z.object({
  seasonId: Id,
  teamId: Id,
  points: z.number().int().min(-99).max(99).refine((p) => p !== 0, "Enter the points to add or take off."),
  reason: z.string().trim().min(3, "Say why, e.g. “Ineligible player, Game #204”.").max(200),
});

export async function addPointAdjustment(input: z.input<typeof AdjustmentInput>): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const data = AdjustmentInput.parse(input);
    const me = await requireAdminUser();
    await assertSeasonWritable(data.seasonId);
    const team = await db.team.findUnique({ where: { id: data.teamId }, select: { id: true, name: true, seasonId: true } });
    if (!team || team.seasonId !== data.seasonId) throw new ActionError("Pick a team from that season.", 400);
    const row = await db.pointAdjustment.create({ data: { seasonId: data.seasonId, teamId: team.id, points: data.points, reason: data.reason, createdByUserId: me.id } });
    await audit(me, { action: "standings.adjusted", entityType: "team", entityId: team.id, summary: `${data.points > 0 ? "+" : ""}${data.points} points for ${team.name}: ${data.reason}` });
    refreshAll();
    return { ok: true, message: `${team.name}: ${data.points > 0 ? "+" : ""}${data.points} points`, data: { id: row.id } };
  });
}

export async function deletePointAdjustment(input: { id: string }): Promise<ActionResult> {
  return runAction(async () => {
    const id = Id.parse(input.id);
    const me = await requireAdminUser();
    const row = await db.pointAdjustment.findUnique({ where: { id }, include: { team: { select: { name: true } } } });
    if (!row) throw new ActionError("That adjustment is already gone.", 404);
    await assertSeasonWritable(row.seasonId);
    await db.pointAdjustment.delete({ where: { id } });
    await audit(me, { action: "standings.adjustment_removed", entityType: "team", entityId: row.teamId, summary: `Removed ${row.points > 0 ? "+" : ""}${row.points} points for ${row.team.name} (${row.reason})` });
    refreshAll();
    return { ok: true, message: "Adjustment removed" };
  });
}

/* ------------------------------------------------------------------ */
/* Round-robin generator                                               */
/* ------------------------------------------------------------------ */

const GenerateInput = z
  .object({
    seasonId: Id,
    divisionIds: z.array(Id).min(1, "Pick at least one division.").max(30),
    startDate: IsoDate,
    endDate: IsoDate,
    double: z.boolean().default(false),
    /** Holidays and other days without matches */
    skipDates: z.array(IsoDate).max(60).default([]),
  })
  .refine((g) => g.endDate >= g.startDate, { message: "The last day can’t be before the first.", path: ["endDate"] });

export type PlannedMatch = { date: string; time: string; fieldId: string; fieldName: string; divisionId: string; divisionName: string; homeTeamId: string; homeName: string; awayTeamId: string; awayName: string; round: number };
export type SchedulePlan = { matches: PlannedMatch[]; unscheduled: { divisionName: string; homeName: string; awayName: string; round: number }[]; notes: string[] };

async function planSchedule(input: z.input<typeof GenerateInput>): Promise<SchedulePlan> {
  const g = GenerateInput.parse(input);
  await assertSeasonWritable(g.seasonId);
  const divisions = await db.division.findMany({ where: { id: { in: g.divisionIds }, seasonId: g.seasonId }, select: { id: true, name: true } });
  if (divisions.length !== g.divisionIds.length) throw new ActionError("Pick divisions from that season.", 400);
  const teams = await db.team.findMany({ where: { seasonId: g.seasonId, divisionId: { in: g.divisionIds }, status: { not: "INACTIVE" } }, select: { id: true, name: true, divisionId: true }, orderBy: { name: "asc" } });
  const fields = await db.field.findMany({ where: { active: true }, include: { park: { select: { name: true } }, availability: { where: { OR: [{ seasonId: null }, { seasonId: g.seasonId }] } } } });
  const windows: Window[] = fields.flatMap((f) => f.availability.map((a) => ({ fieldId: f.id, weekday: a.weekday, startMinute: a.startMinute, endMinute: a.endMinute })));
  if (!windows.length) throw new ActionError("No field has availability yet. Add weekly times on Settings › Fields first.", 409);

  const notes: string[] = [];
  for (const d of divisions) {
    const n = teams.filter((t) => t.divisionId === d.id).length;
    if (n < 2) notes.push(`${d.name} has ${n === 0 ? "no teams" : "one team"}, so it gets no matches.`);
  }
  // Never in the past: from today at the earliest
  const today = dayKey(now());
  const from = g.startDate < today ? today : g.startDate;
  if (from !== g.startDate) notes.push(`Starts today (${today}): earlier dates have passed.`);
  const dates = from > g.endDate ? [] : matchDays(from, g.endDate, new Set(windows.map((w) => w.weekday)), new Set(g.skipDates));
  // What's already on the calendar in that range
  const existing = await db.match.findMany({
    where: { seasonId: g.seasonId, status: { not: "CANCELLED" }, scheduledAt: { gte: easternTime(g.startDate, "00:00"), lte: easternTime(g.endDate, "23:59") } },
    select: { homeTeamId: true, awayTeamId: true, scheduledAt: true, fieldId: true, divisionId: true },
  });
  const already = existing.filter((m) => m.divisionId && g.divisionIds.includes(m.divisionId)).length;
  if (already) notes.push(`These divisions already have ${already} match${already === 1 ? "" : "es"} in that range; the new schedule works around them.`);
  const blackoutRows = await db.teamBlackout.findMany({ where: { teamId: { in: teams.map((t) => t.id) } }, select: { teamId: true, date: true } });
  const blackouts = new Map<string, Set<string>>();
  for (const b of blackoutRows) blackouts.set(b.teamId, (blackouts.get(b.teamId) ?? new Set()).add(b.date.toISOString().slice(0, 10)));

  const result = generateSchedule({
    divisions: divisions.map((d) => ({ id: d.id, teamIds: teams.filter((t) => t.divisionId === d.id).map((t) => t.id) })),
    dates,
    windows,
    double: g.double,
    slotMinutes: FIELD_GAP_MINUTES,
    matchMinutes: MATCH_MINUTES,
    blackouts,
    taken: existing.filter((m) => m.fieldId).map((m) => ({ date: dayKey(m.scheduledAt), fieldId: m.fieldId!, startMinute: minuteOf(m.scheduledAt) })),
    busy: existing.flatMap((m) => [m.homeTeamId, m.awayTeamId].map((teamId) => ({ teamId, date: dayKey(m.scheduledAt) }))),
  });
  const name = (id: string) => teams.find((t) => t.id === id)?.name ?? "?";
  const div = (id: string) => divisions.find((d) => d.id === id)?.name ?? "?";
  const field = (id: string) => {
    const f = fields.find((x) => x.id === id);
    return f ? `${f.park.name} ${f.name}` : "?";
  };
  if (!dates.length) notes.push("No match days: no field is available on any day in that range.");
  return {
    matches: result.matches.map((m) => ({ date: m.date, time: hhmm(m.startMinute), fieldId: m.fieldId, fieldName: field(m.fieldId), divisionId: m.divisionId, divisionName: div(m.divisionId), homeTeamId: m.homeTeamId, homeName: name(m.homeTeamId), awayTeamId: m.awayTeamId, awayName: name(m.awayTeamId), round: m.round })),
    unscheduled: result.unscheduled.map((u) => ({ divisionName: div(u.divisionId), homeName: name(u.homeTeamId), awayName: name(u.awayTeamId), round: u.round })),
    notes,
  };
}

export async function previewSchedule(input: z.input<typeof GenerateInput>): Promise<ActionResult<SchedulePlan>> {
  return runAction(async () => {
    await requireAdminUser();
    const plan = await planSchedule(input);
    return { ok: true, message: `${plan.matches.length} matches planned`, data: plan };
  });
}

/** Creates the planned matches (recomputed here, the same way as the preview). */
export async function createSchedule(input: z.input<typeof GenerateInput>): Promise<ActionResult<{ created: number }>> {
  return runAction(
    async () => {
      const me = await requireAdminUser();
      const plan = await planSchedule(input);
      if (!plan.matches.length) throw new ActionError("Nothing to create: no matches fit those dates and fields.", 409);
      const seasonId = GenerateInput.parse(input).seasonId;
      const created = await createMatches(seasonId, plan.matches.map((m) => ({ ...m, gameNumber: null })));
      await audit(me, { action: "schedule.generated", entityType: "season", entityId: seasonId, summary: `Generated ${created} matches (round robin${plan.unscheduled.length ? `, ${plan.unscheduled.length} left unscheduled` : ""})` });
      refreshAll();
      return { ok: true, message: `${created} matches created`, data: { created } };
    },
    { transaction: { timeout: 60_000 } },
  );
}

type NewMatch = { date: string; time: string; fieldId: string | null; fieldName: string | null; divisionId: string; homeTeamId: string; awayTeamId: string; gameNumber: number | null };

async function createMatches(seasonId: string, rows: NewMatch[]) {
  const last = await db.match.findFirst({ where: { seasonId }, orderBy: { gameNumber: "desc" }, select: { gameNumber: true } });
  let next = (last?.gameNumber ?? 0) + 1;
  const parks = await db.field.findMany({ where: { id: { in: rows.map((r) => r.fieldId).filter((x): x is string => !!x) } }, select: { id: true, park: { select: { name: true } } } });
  const ordered = [...rows].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  await db.$transaction(async (tx) => {
    for (const r of ordered) {
      const scheduledAt = easternTime(r.date, r.time);
      await tx.match.create({
        data: {
          seasonId,
          divisionId: r.divisionId,
          gameNumber: r.gameNumber ?? next++,
          homeTeamId: r.homeTeamId,
          awayTeamId: r.awayTeamId,
          scheduledAt,
          startTime: scheduledAt,
          endTime: new Date(scheduledAt.getTime() + 105 * 60_000),
          fieldId: r.fieldId,
          field: r.fieldName,
          location: parks.find((p) => p.id === r.fieldId)?.park.name ?? null,
          status: "SCHEDULED",
        },
      });
    }
  });
  return ordered.length;
}

/* ------------------------------------------------------------------ */
/* CSV import                                                          */
/* ------------------------------------------------------------------ */

const ImportInput = z.object({ seasonId: Id, csv: z.string().max(200_000) });

export type ImportPreview = {
  rows: { line: number; date: string; time: string; home: string; away: string; division: string; field: string | null; gameNumber: number | null }[];
  errors: { line: number; message: string }[];
  warnings: { line: number; message: string }[];
};

async function planImport(input: z.input<typeof ImportInput>) {
  const { seasonId, csv } = ImportInput.parse(input);
  await assertSeasonWritable(seasonId);
  const parsed = parseScheduleCsv(csv);
  const errors = [...parsed.errors];
  const warnings: ImportPreview["warnings"] = [];
  const teams = await db.team.findMany({ where: { seasonId }, select: { id: true, name: true, code: true, divisionId: true, division: { select: { name: true, code: true } } } });
  const fields = await db.field.findMany({ include: { park: { select: { name: true } } } });
  const existing = await db.match.findMany({ where: { seasonId, status: { not: "CANCELLED" } }, select: { id: true, gameNumber: true, homeTeamId: true, awayTeamId: true, scheduledAt: true, fieldId: true, status: true } });
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const team = (v: string) => teams.find((t) => norm(t.name) === norm(v) || (t.code && norm(t.code) === norm(v)));
  const fieldFor = (v: string) => {
    const full = fields.filter((f) => norm(`${f.park.name} ${f.name}`) === norm(v));
    if (full.length === 1) return full[0];
    const short = fields.filter((f) => norm(f.name) === norm(v));
    return short.length === 1 ? short[0] : null;
  };
  const names = Object.fromEntries(teams.map((t) => [t.id, t.name]));
  const usedNumbers = new Set(existing.map((m) => m.gameNumber));
  const placed: Slot[] = existing.map((m) => ({ id: m.id, gameNumber: m.gameNumber, homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId, scheduledAt: m.scheduledAt, fieldId: m.fieldId, status: m.status }));
  const rows: (NewMatch & { line: number; home: string; away: string; division: string })[] = [];

  for (const r of parsed.rows) {
    const home = team(r.home);
    const away = team(r.away);
    const problems: string[] = [];
    if (!home) problems.push(`no team “${r.home}” this season`);
    if (!away) problems.push(`no team “${r.away}” this season`);
    if (home && away && home.id === away.id) problems.push("a team can’t play itself");
    if (home && away && home.divisionId !== away.divisionId) problems.push(`${home.name} and ${away.name} are in different divisions`);
    if (home && r.division && ![home.division.name, home.division.code].some((x) => norm(x) === norm(r.division!))) problems.push(`${home.name} isn’t in “${r.division}”`);
    const field = r.field ? fieldFor(r.field) : null;
    if (r.field && !field) problems.push(`no field “${r.field}” (use “Park Field”, e.g. “${fields[0] ? `${fields[0].park.name} ${fields[0].name}` : "Wakefield Park 3"}”)`);
    if (r.gameNumber != null && usedNumbers.has(r.gameNumber)) problems.push(`Game #${r.gameNumber} already exists`);
    if (problems.length) {
      errors.push({ line: r.line, message: problems.join("; ") });
      continue;
    }
    if (r.gameNumber != null) usedNumbers.add(r.gameNumber);
    const scheduledAt = easternTime(r.date, r.time);
    const fieldName = field ? `${field.park.name} ${field.name}` : null;
    for (const w of scheduleConflicts({ homeTeamId: home!.id, awayTeamId: away!.id, scheduledAt, fieldId: field?.id ?? null }, placed, names, fieldName)) warnings.push({ line: r.line, message: w });
    placed.push({ homeTeamId: home!.id, awayTeamId: away!.id, scheduledAt, fieldId: field?.id ?? null });
    rows.push({ line: r.line, date: r.date, time: r.time, fieldId: field?.id ?? null, fieldName, divisionId: home!.divisionId, homeTeamId: home!.id, awayTeamId: away!.id, gameNumber: r.gameNumber, home: home!.name, away: away!.name, division: home!.division.name });
  }
  return { seasonId, rows, errors: errors.sort((a, b) => a.line - b.line), warnings };
}

export async function previewImport(input: z.input<typeof ImportInput>): Promise<ActionResult<ImportPreview>> {
  return runAction(async () => {
    await requireAdminUser();
    const plan = await planImport(input);
    return {
      ok: true,
      message: `${plan.rows.length} matches ready`,
      data: { rows: plan.rows.map((r) => ({ line: r.line, date: r.date, time: r.time, home: r.home, away: r.away, division: r.division, field: r.fieldName, gameNumber: r.gameNumber })), errors: plan.errors, warnings: plan.warnings },
    };
  });
}

/** Imports the CSV when every line is valid (clashes are warnings: the preview shows them). */
export async function importSchedule(input: z.input<typeof ImportInput>): Promise<ActionResult<{ created: number }>> {
  return runAction(
    async () => {
      const me = await requireAdminUser();
      const plan = await planImport(input);
      if (plan.errors.length) throw new ActionError(`Fix ${plan.errors.length} line${plan.errors.length === 1 ? "" : "s"} first.`, 400, plan.errors.map((e) => `Line ${e.line}: ${e.message}`));
      if (!plan.rows.length) throw new ActionError("No matches in that file.", 400);
      const created = await createMatches(plan.seasonId, plan.rows);
      await audit(me, { action: "schedule.imported", entityType: "season", entityId: plan.seasonId, summary: `Imported ${created} matches from CSV` });
      refreshAll();
      return { ok: true, message: `${created} matches imported`, data: { created } };
    },
    { transaction: { timeout: 60_000 } },
  );
}
