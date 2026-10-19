"use server";

/**
 * League structure for the office: seasons, divisions, teams and matches. Every action re-checks
 * admin access on the server and refuses seasons that are over.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { now } from "@/lib/clock";
import { checkEligibility } from "@/lib/eligibility";
import { fullName } from "@/lib/format";
import { easternTime } from "@/lib/game-pass";
import { seasonSlug } from "@/lib/public";
import { assertSeasonWritable } from "@/lib/queries/season";
import { syncMatchReportStatus } from "@/lib/reports";
import { matchTeamErrors, scheduleConflicts } from "@/lib/schedule-rules";
import { assertJerseyFree, requireAdminUser, teamForRoster } from "./admin-guard";
import { ActionError, runAction, type ActionResult } from "./result";

const Id = z.string().trim().min(1).max(64);
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date.");
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** Admin pages plus every public page that shows league structure. */
function refreshAll() {
  revalidatePath("/", "layout");
}

/* ------------------------------------------------------------------ */
/* Seasons                                                             */
/* ------------------------------------------------------------------ */

const SeasonInput = z
  .object({
    name: z.string().trim().min(3, "Name the season, e.g. Fall 2026.").max(40),
    startDate: IsoDate,
    endDate: IsoDate,
    makeActive: z.boolean().default(false),
  })
  .refine((s) => s.endDate >= s.startDate, { message: "The season can’t end before it starts.", path: ["endDate"] });

async function uniqueSeasonSlug(name: string, exceptId?: string) {
  const base = seasonSlug(name) || "season";
  let slug = base;
  for (let i = 2; await prisma.season.findFirst({ where: { slug, ...(exceptId ? { id: { not: exceptId } } : {}) } }); i++) slug = `${base}-${i}`;
  return slug;
}

/** Creates a season (opening day = start date). Making it active closes registration on the old one. */
export async function createSeason(input: z.input<typeof SeasonInput>): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const data = SeasonInput.parse(input);
    await requireAdminUser();
    if (await prisma.season.findFirst({ where: { name: { equals: data.name, mode: "insensitive" } } })) throw new ActionError(`There’s already a season called ${data.name}.`, 409);
    const active = await prisma.season.findFirst({ where: { isActive: true }, include: { settings: true } });
    const slug = await uniqueSeasonSlug(data.name);
    const season = await prisma.$transaction(async (tx) => {
      if (data.makeActive) await tx.season.updateMany({ where: { isActive: true }, data: { isActive: false } });
      const s = await tx.season.create({
        data: { name: data.name, slug, startDate: day(data.startDate), endDate: day(data.endDate), isActive: data.makeActive },
      });
      // Start from the current season's league settings
      await tx.leagueSettings.create({
        data: {
          seasonId: s.id,
          gamePassFee: active?.settings?.gamePassFee ?? 15,
          maxMatchRoster: active?.settings?.maxMatchRoster ?? 18,
          fairfaxCountyAllowed: active?.settings?.fairfaxCountyAllowed ?? true,
        },
      });
      return s;
    });
    refreshAll();
    return { ok: true, message: `${season.name} created${data.makeActive ? " and made active" : ""}`, data: { id: season.id } };
  });
}

export async function updateSeason(input: z.input<typeof SeasonInput> & { id: string }): Promise<ActionResult> {
  return runAction(async () => {
    const data = SeasonInput.parse(input);
    const id = Id.parse(input.id);
    await requireAdminUser();
    const season = await prisma.season.findUnique({ where: { id } });
    if (!season) throw new ActionError("Season not found.", 404);
    if (await prisma.season.findFirst({ where: { id: { not: id }, name: { equals: data.name, mode: "insensitive" } } })) throw new ActionError(`There’s already a season called ${data.name}.`, 409);
    if (season.isActive && !data.makeActive) throw new ActionError("Make another season active instead; there always has to be one.", 409);
    const slug = data.name === season.name ? season.slug : await uniqueSeasonSlug(data.name, id);
    await prisma.$transaction(async (tx) => {
      if (data.makeActive && !season.isActive) await tx.season.updateMany({ where: { isActive: true }, data: { isActive: false } });
      await tx.season.update({ where: { id }, data: { name: data.name, slug, startDate: day(data.startDate), endDate: day(data.endDate), isActive: data.makeActive } });
    });
    refreshAll();
    return { ok: true, message: `${data.name} saved` };
  });
}

/* ------------------------------------------------------------------ */
/* Divisions                                                           */
/* ------------------------------------------------------------------ */

const OptionalCount = z.number().int().min(0).max(999).nullish();

const DivisionInput = z
  .object({
    seasonId: Id,
    name: z.string().trim().min(2, "Name the division.").max(60),
    code: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9-]{1,20}$/, "Codes use letters, numbers and dashes (shown in URLs).")
      .optional()
      .or(z.literal("")),
    level: z.string().trim().max(60).optional(),
    description: z.string().trim().max(200).optional(),
    fee: z.number({ invalid_type_error: "Enter the registration fee." }).min(0).max(10_000),
    gamePassFee: z.number().min(0).max(10_000).nullish(),
    status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
    genderRule: z.enum(["WOMEN", "MEN", "COED"]),
    minAge: z.number().int().min(0).max(99),
    maleCutoff: IsoDate.nullish(),
    femaleCutoff: IsoDate.nullish(),
    displayOrder: z.number().int().min(0).max(999).default(0),
    maxTeams: OptionalCount,
    rosterMin: OptionalCount,
    rosterMax: OptionalCount,
  })
  .refine((d) => d.rosterMin == null || d.rosterMax == null || d.rosterMin <= d.rosterMax, { message: "Roster minimum can’t be more than the maximum.", path: ["rosterMin"] });

async function uniqueDivisionCode(seasonId: string, wanted: string, exceptId?: string) {
  const base = wanted || "division";
  let code = base;
  for (let i = 2; await prisma.division.findFirst({ where: { seasonId, code, ...(exceptId ? { id: { not: exceptId } } : {}) } }); i++) code = `${base}-${i}`;
  return code;
}

function divisionData(d: z.infer<typeof DivisionInput>) {
  return {
    name: d.name,
    level: d.level || null,
    description: d.description || null,
    registrationFee: d.fee,
    gamePassFee: d.gamePassFee ?? null,
    status: d.status,
    genderRule: d.genderRule,
    minAge: d.minAge,
    displayOrder: d.displayOrder,
    maxTeams: d.maxTeams ?? null,
    rosterMin: d.rosterMin ?? null,
    rosterMax: d.rosterMax ?? null,
    maleBornOnOrBefore: d.genderRule === "WOMEN" || !d.maleCutoff ? null : day(d.maleCutoff),
    femaleBornOnOrBefore: d.genderRule === "MEN" || !d.femaleCutoff ? null : day(d.femaleCutoff),
  };
}

export async function createDivision(input: z.input<typeof DivisionInput>): Promise<ActionResult<{ code: string }>> {
  return runAction(async () => {
    const data = DivisionInput.parse(input);
    await requireAdminUser();
    await assertSeasonWritable(data.seasonId);
    if (await prisma.division.findFirst({ where: { seasonId: data.seasonId, name: { equals: data.name, mode: "insensitive" } } })) {
      throw new ActionError(`This season already has a division called ${data.name}.`, 409);
    }
    const code = await uniqueDivisionCode(data.seasonId, data.code || seasonSlug(data.name).slice(0, 20));
    await prisma.division.create({ data: { ...divisionData(data), seasonId: data.seasonId, code } });
    refreshAll();
    return { ok: true, message: `${data.name} created`, data: { code } };
  });
}

export async function updateDivision(input: z.input<typeof DivisionInput> & { id: string }): Promise<ActionResult<{ code: string }>> {
  return runAction(async () => {
    const data = DivisionInput.parse(input);
    const id = Id.parse(input.id);
    await requireAdminUser();
    const div = await prisma.division.findUnique({ where: { id }, include: { _count: { select: { teams: true } } } });
    if (!div || div.seasonId !== data.seasonId) throw new ActionError("Division not found.", 404);
    await assertSeasonWritable(div.seasonId);
    if (await prisma.division.findFirst({ where: { seasonId: div.seasonId, id: { not: id }, name: { equals: data.name, mode: "insensitive" } } })) {
      throw new ActionError(`This season already has a division called ${data.name}.`, 409);
    }
    if (data.maxTeams != null && data.maxTeams < div._count.teams) {
      throw new ActionError(`${div.name} already has ${div._count.teams} teams, so max teams can’t be lower than that.`, 409);
    }
    const code = data.code && data.code !== div.code ? await uniqueDivisionCode(div.seasonId, data.code, id) : div.code;
    await prisma.division.update({ where: { id }, data: { ...divisionData(data), code } });
    refreshAll();
    return { ok: true, message: `${data.name} saved`, data: { code } };
  });
}

/** Deletes an unused division. One with teams or registrations has to be set to inactive instead. */
export async function deleteDivision(input: { id: string }): Promise<ActionResult> {
  return runAction(async () => {
    const id = Id.parse(input.id);
    await requireAdminUser();
    const div = await prisma.division.findUnique({ where: { id }, include: { _count: { select: { teams: true, registrations: true, matches: true } } } });
    if (!div) throw new ActionError("Division not found.", 404);
    await assertSeasonWritable(div.seasonId);
    const { teams, registrations, matches } = div._count;
    if (teams || registrations || matches) {
      const used = [
        teams && `${teams} team${teams === 1 ? "" : "s"}`,
        registrations && `${registrations} registration${registrations === 1 ? "" : "s"}`,
        !teams && matches && `${matches} match${matches === 1 ? "" : "es"}`,
      ]
        .filter(Boolean)
        .join(" and ");
      throw new ActionError(`${div.name} has ${used}, so it can’t be deleted. Set it to inactive instead.`, 409);
    }
    await prisma.division.delete({ where: { id } });
    refreshAll();
    return { ok: true, message: `${div.name} deleted` };
  });
}

/** `years` before `d`, as a date-only value. */
const yearsBefore = (d: Date, years: number) => new Date(Date.UTC(d.getUTCFullYear() - years, d.getUTCMonth(), d.getUTCDate()));

/**
 * A birth-date cutoff for the new season. "minAge on opening day" follows the new opening day;
 * any other cutoff moves by the whole years between the seasons.
 */
function carryCutoff(cutoff: Date | null, minAge: number, from: Date, to: Date) {
  if (!cutoff) return null;
  if (cutoff.getTime() === yearsBefore(from, minAge).getTime()) return yearsBefore(to, minAge);
  return yearsBefore(cutoff, from.getUTCFullYear() - to.getUTCFullYear());
}

/**
 * Copies another season's divisions (name, level, fees, age rules, who can play, limits) into a
 * season. "18 on opening day" cutoffs follow the new opening day and fixed cutoffs move by the years
 * between the seasons; divisions whose name already exists in the target are skipped.
 */
export async function copyDivisions(input: { fromSeasonId: string; toSeasonId: string }): Promise<ActionResult<{ copied: string[]; skipped: string[] }>> {
  return runAction(async () => {
    const fromId = Id.parse(input.fromSeasonId);
    const toId = Id.parse(input.toSeasonId);
    await requireAdminUser();
    if (fromId === toId) throw new ActionError("Pick a different season to copy from.", 400);
    await assertSeasonWritable(toId);
    const [from, to] = await Promise.all([
      prisma.season.findUnique({ where: { id: fromId }, include: { divisions: { orderBy: [{ displayOrder: "asc" }, { name: "asc" }] } } }),
      prisma.season.findUnique({ where: { id: toId }, include: { divisions: { select: { name: true, code: true } } } }),
    ]);
    if (!from || !to) throw new ActionError("Season not found.", 404);
    if (!from.divisions.length) throw new ActionError(`${from.name} has no divisions to copy.`, 400);

    const names = new Set(to.divisions.map((d) => d.name.toLowerCase()));
    const codes = new Set(to.divisions.map((d) => d.code));
    const copied: string[] = [];
    const skipped: string[] = [];
    const rows = [];
    for (const d of from.divisions) {
      if (names.has(d.name.toLowerCase())) {
        skipped.push(d.name);
        continue;
      }
      let code = d.code;
      for (let i = 2; codes.has(code); i++) code = `${d.code}-${i}`;
      codes.add(code);
      names.add(d.name.toLowerCase());
      copied.push(d.name);
      rows.push({
        seasonId: to.id,
        code,
        name: d.name,
        level: d.level,
        // Rule text that names a date would be stale; without it the rule is written from the cutoffs
        description: d.description && /\b(19|20)\d\d\b/.test(d.description) && to.startDate.getTime() !== from.startDate.getTime() ? null : d.description,
        registrationFee: d.registrationFee,
        gamePassFee: d.gamePassFee,
        status: d.status,
        genderRule: d.genderRule,
        minAge: d.minAge,
        maleBornOnOrBefore: carryCutoff(d.maleBornOnOrBefore, d.minAge, from.startDate, to.startDate),
        femaleBornOnOrBefore: carryCutoff(d.femaleBornOnOrBefore, d.minAge, from.startDate, to.startDate),
        displayOrder: d.displayOrder,
        maxTeams: d.maxTeams,
        rosterMin: d.rosterMin,
        rosterMax: d.rosterMax,
      });
    }
    if (!rows.length) throw new ActionError(`${to.name} already has every division from ${from.name}.`, 409);
    await prisma.division.createMany({ data: rows });
    refreshAll();
    return {
      ok: true,
      message: `Copied ${copied.length} division${copied.length === 1 ? "" : "s"} from ${from.name}${skipped.length ? ` (skipped ${skipped.join(", ")}: already here)` : ""}`,
      data: { copied, skipped },
    };
  });
}

/* ------------------------------------------------------------------ */
/* Teams                                                               */
/* ------------------------------------------------------------------ */

const TeamInput = z.object({
  seasonId: Id,
  divisionId: Id,
  name: z.string().trim().min(2, "Name the team.").max(60),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  captainPlayerIds: z.array(Id).max(4).default([]),
});

async function assertTeamNameFree(seasonId: string, name: string, exceptId?: string) {
  const clash = await prisma.team.findFirst({ where: { seasonId, name: { equals: name, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) } });
  if (clash) throw new ActionError(`There’s already a team called ${clash.name} this season.`, 409);
}

async function divisionInSeason(divisionId: string, seasonId: string) {
  const div = await prisma.division.findUnique({ where: { id: divisionId }, include: { season: true } });
  if (!div || div.seasonId !== seasonId) throw new ActionError("Pick a division from that season.", 400);
  return div;
}

/** Refuses a new team in a division that has reached its max teams. */
async function assertDivisionHasRoom(div: { id: string; name: string; maxTeams: number | null }) {
  if (div.maxTeams == null) return;
  const teams = await prisma.team.count({ where: { divisionId: div.id } });
  if (teams >= div.maxTeams) throw new ActionError(`${div.name} is full (${div.maxTeams} teams). Raise its max teams first.`, 409);
}

/** Short code for URLs and crests: initials, unique within the season. */
async function teamCode(seasonId: string, name: string) {
  const base = (name.match(/\b[A-Za-z0-9]/g) ?? ["t"]).join("").toLowerCase().slice(0, 4) || "team";
  let code = base;
  for (let i = 2; await prisma.team.findFirst({ where: { seasonId, code } }); i++) code = `${base}${i}`;
  return code;
}

/** Creates a team; chosen captains join its roster as captains (they must fit the division). */
export async function createTeam(input: z.input<typeof TeamInput>): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const data = TeamInput.parse(input);
    await requireAdminUser();
    await assertSeasonWritable(data.seasonId);
    const div = await divisionInSeason(data.divisionId, data.seasonId);
    await assertTeamNameFree(data.seasonId, data.name);
    await assertDivisionHasRoom(div);
    const captains = data.captainPlayerIds.length ? await prisma.player.findMany({ where: { id: { in: data.captainPlayerIds } } }) : [];
    if (captains.length !== new Set(data.captainPlayerIds).size) throw new ActionError("Some captains weren’t found.", 400);
    for (const p of captains) {
      const elig = checkEligibility(div, { dob: p.dob, gender: p.gender }, div.season.startDate);
      if (!elig.ok) throw new ActionError(`${fullName(p)} can’t play in ${div.name}: ${elig.reason}.`, 400);
    }
    const code = await teamCode(data.seasonId, data.name);
    const team = await prisma.team.create({
      data: {
        seasonId: data.seasonId,
        divisionId: div.id,
        name: data.name,
        code,
        shortName: code.toUpperCase().slice(0, 3),
        status: data.status,
        roster: { create: captains.map((p) => ({ playerId: p.id, divisionId: div.id, membershipType: "SEASONAL" as const, isCaptain: true })) },
      },
    });
    refreshAll();
    return { ok: true, message: `${team.name} created`, data: { id: team.id } };
  });
}

const TeamUpdateInput = TeamInput.omit({ captainPlayerIds: true, seasonId: true }).extend({
  id: Id,
  shortName: z.string().trim().max(4).optional(),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Pick a color.")
    .optional()
    .or(z.literal("")),
  homeField: z.string().trim().max(80).optional(),
});

/** Name, division (only while the team has no matches), status, crest and home field. */
export async function updateTeam(input: z.input<typeof TeamUpdateInput>): Promise<ActionResult> {
  return runAction(async () => {
    const data = TeamUpdateInput.parse(input);
    await requireAdminUser();
    const team = await prisma.team.findUnique({ where: { id: data.id } });
    if (!team) throw new ActionError("Team not found.", 404);
    await assertSeasonWritable(team.seasonId);
    const div = await divisionInSeason(data.divisionId, team.seasonId);
    await assertTeamNameFree(team.seasonId, data.name, team.id);
    const moving = data.divisionId !== team.divisionId;
    if (moving && (await prisma.match.count({ where: { OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }] } }))) {
      throw new ActionError("This team has matches in its division. Move or delete those first, then change its division.", 409);
    }
    if (moving) await assertDivisionHasRoom(div);
    await prisma.$transaction(async (tx) => {
      await tx.team.update({
        where: { id: team.id },
        data: { name: data.name, divisionId: data.divisionId, status: data.status, shortName: data.shortName || null, color: data.color || null, homeField: data.homeField || null },
      });
      if (moving) await tx.teamRoster.updateMany({ where: { teamId: team.id }, data: { divisionId: data.divisionId } });
    });
    refreshAll();
    return { ok: true, message: `${data.name} saved` };
  });
}

/** Deletes a team with no matches. Teams with matches should be set inactive instead. */
export async function deleteTeam(input: { id: string }): Promise<ActionResult> {
  return runAction(async () => {
    const { id } = z.object({ id: Id }).parse(input);
    await requireAdminUser();
    const team = await prisma.team.findUnique({ where: { id }, include: { _count: { select: { homeMatches: true, awayMatches: true, gamePasses: true } } } });
    if (!team) throw new ActionError("Team not found.", 404);
    await assertSeasonWritable(team.seasonId);
    const matches = team._count.homeMatches + team._count.awayMatches;
    if (matches) throw new ActionError(`${team.name} has ${matches} match${matches === 1 ? "" : "es"}, so it can’t be deleted. Set it to inactive instead.`, 409);
    if (team._count.gamePasses) throw new ActionError(`${team.name} has game passes, so it can’t be deleted. Set it to inactive instead.`, 409);
    await prisma.team.delete({ where: { id } });
    refreshAll();
    return { ok: true, message: `${team.name} deleted` };
  });
}

const JerseyInput = z.object({ playerId: Id, teamId: Id, jerseyNumber: z.number().int().min(0).max(99).nullable() });

export async function setJerseyNumber(input: z.input<typeof JerseyInput>): Promise<ActionResult> {
  return runAction(async () => {
    const data = JerseyInput.parse(input);
    await requireAdminUser();
    const team = await teamForRoster(data.teamId);
    const row = await prisma.teamRoster.findFirst({ where: { playerId: data.playerId, teamId: team.id, membershipType: "SEASONAL", leftAt: null }, include: { player: true } });
    if (!row) throw new ActionError("That player isn’t on this team.", 404);
    await assertJerseyFree(team.id, data.jerseyNumber, data.playerId);
    await prisma.teamRoster.update({ where: { id: row.id }, data: { jerseyNumber: data.jerseyNumber } });
    refreshAll();
    return { ok: true, message: data.jerseyNumber == null ? `${fullName(row.player)}’s number cleared` : `${fullName(row.player)} wears #${data.jerseyNumber}` };
  });
}

/* ------------------------------------------------------------------ */
/* Matches                                                             */
/* ------------------------------------------------------------------ */

const Score = z.number().int().min(0).max(99).nullable();
const MatchInput = z.object({
  seasonId: Id,
  divisionId: Id,
  homeTeamId: z.string().trim().max(64),
  awayTeamId: z.string().trim().max(64),
  date: IsoDate,
  time: z.string().regex(/^\d{2}:\d{2}$/, "Pick a start time."),
  fieldId: Id.nullish(),
  /** A field that isn't in the list yet (complex + field). */
  newField: z.object({ complex: z.string().trim().min(2).max(80), name: z.string().trim().min(1).max(20), city: z.string().trim().max(60).optional() }).nullish(),
  status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED", "POSTPONED"]),
  gameNumber: z.number().int().min(1).max(999_999).nullish(),
  homeScore: Score.default(null),
  awayScore: Score.default(null),
  /** Save even though the schedule check found clashes. */
  force: z.boolean().default(false),
});

type MatchData = z.infer<typeof MatchInput>;

/** Validates a create/update and returns what to write. Clashes come back as a 409 unless forced. */
async function prepareMatch(data: MatchData, matchId?: string) {
  await assertSeasonWritable(data.seasonId);
  const div = await divisionInSeason(data.divisionId, data.seasonId);
  const teams = await prisma.team.findMany({ where: { id: { in: [data.homeTeamId, data.awayTeamId].filter(Boolean) } }, select: { id: true, name: true, divisionId: true, seasonId: true } });
  const errors = matchTeamErrors(data, teams);
  if (data.status === "COMPLETED" && (data.homeScore == null || data.awayScore == null)) errors.push("Enter both scores for a completed match.");
  if (errors.length) throw new ActionError(errors[0], 400, errors);

  const scheduledAt = easternTime(data.date, data.time);
  // A typed-in field is only created once every check below passes
  const nf = data.newField;
  let field = nf
    ? await prisma.field.findUnique({ where: { complex_name: { complex: nf.complex, name: nf.name } } })
    : data.fieldId
      ? await prisma.field.findUnique({ where: { id: data.fieldId } })
      : null;
  if (data.fieldId && !nf && !field) throw new ActionError("Pick a field from the list.", 400);
  let fieldId = field?.id ?? null;
  const fieldName = field ? `${field.complex} ${field.name}` : nf ? `${nf.complex} ${nf.name}` : null;

  if (!data.force && data.status !== "CANCELLED") {
    const sameDay = await prisma.match.findMany({
      where: { seasonId: data.seasonId, scheduledAt: { gte: new Date(scheduledAt.getTime() - 3 * 3600_000), lte: new Date(scheduledAt.getTime() + 3 * 3600_000) } },
      select: { id: true, gameNumber: true, homeTeamId: true, awayTeamId: true, scheduledAt: true, fieldId: true, status: true },
    });
    const warnings = scheduleConflicts({ id: matchId, homeTeamId: data.homeTeamId, awayTeamId: data.awayTeamId, scheduledAt, fieldId }, sameDay, Object.fromEntries(teams.map((t) => [t.id, t.name])), fieldName);
    if (warnings.length) throw new ActionError("Check the schedule before saving.", 409, warnings);
  }

  const gameNumber = data.gameNumber ?? null;
  if (gameNumber != null) {
    const taken = await prisma.match.findFirst({ where: { seasonId: data.seasonId, gameNumber, ...(matchId ? { id: { not: matchId } } : {}) } });
    if (taken) throw new ActionError(`Game #${gameNumber} already exists this season.`, 409);
  }

  if (nf && !field) {
    field = await prisma.field.create({ data: { complex: nf.complex, name: nf.name, city: nf.city || null, state: "VA" } });
    fieldId = field.id;
  }

  const completed = data.status === "COMPLETED";
  return {
    div,
    gameNumber,
    write: {
      divisionId: div.id,
      homeTeamId: data.homeTeamId,
      awayTeamId: data.awayTeamId,
      scheduledAt,
      startTime: scheduledAt,
      endTime: new Date(scheduledAt.getTime() + 105 * 60_000),
      fieldId,
      field: fieldName,
      location: field?.complex ?? null,
      status: data.status,
      // Scores the office enters are the official result, so they count in the standings
      homeScore: completed ? data.homeScore : null,
      awayScore: completed ? data.awayScore : null,
    },
  };
}

export async function createMatch(input: z.input<typeof MatchInput>): Promise<ActionResult<{ id: string; gameNumber: number }>> {
  return runAction(async () => {
    const data = MatchInput.parse(input);
    await requireAdminUser();
    const { gameNumber, write } = await prepareMatch(data);
    const last = await prisma.match.findFirst({ where: { seasonId: data.seasonId }, orderBy: { gameNumber: "desc" }, select: { gameNumber: true } });
    const match = await prisma.match.create({
      data: {
        ...write,
        seasonId: data.seasonId,
        gameNumber: gameNumber ?? (last?.gameNumber ?? 0) + 1,
        reportStatus: write.status === "COMPLETED" ? "CONFIRMED" : "NOT_STARTED",
      },
    });
    refreshAll();
    return { ok: true, message: `Game #${match.gameNumber} created`, data: { id: match.id, gameNumber: match.gameNumber } };
  });
}

export async function updateMatch(input: z.input<typeof MatchInput> & { id: string }): Promise<ActionResult<{ gameNumber: number }>> {
  return runAction(async () => {
    const data = MatchInput.parse(input);
    const id = Id.parse(input.id);
    await requireAdminUser();
    const match = await prisma.match.findUnique({
      where: { id },
      include: { _count: { select: { gamePasses: true, reports: true, matchRosters: true } } },
    });
    if (!match || match.seasonId !== data.seasonId) throw new ActionError("Match not found.", 404);
    const changingTeams = match.homeTeamId !== data.homeTeamId || match.awayTeamId !== data.awayTeamId;
    if (changingTeams && (match._count.gamePasses || match._count.reports || match._count.matchRosters)) {
      throw new ActionError("This match already has match rosters, reports or game passes, so its teams can’t change. Cancel it and create a new one instead.", 409);
    }
    const { gameNumber, write } = await prepareMatch(data, id);
    await prisma.$transaction(async (tx) => {
      await tx.match.update({ where: { id }, data: { ...write, gameNumber: gameNumber ?? match.gameNumber } });
      if (write.status === "COMPLETED") await tx.match.update({ where: { id }, data: { reportStatus: "CONFIRMED" } });
      else await syncMatchReportStatus(tx, id, now());
    });
    refreshAll();
    return { ok: true, message: `Game #${gameNumber ?? match.gameNumber} saved`, data: { gameNumber: gameNumber ?? match.gameNumber } };
  });
}

/** Deletes a match with no game passes. Matches with passes should be cancelled instead. */
export async function deleteMatch(input: { id: string }): Promise<ActionResult> {
  return runAction(async () => {
    const { id } = z.object({ id: Id }).parse(input);
    await requireAdminUser();
    const match = await prisma.match.findUnique({ where: { id }, include: { _count: { select: { gamePasses: true } } } });
    if (!match) throw new ActionError("Match not found.", 404);
    await assertSeasonWritable(match.seasonId);
    if (match._count.gamePasses) {
      throw new ActionError(`Game #${match.gameNumber} has ${match._count.gamePasses} game pass${match._count.gamePasses === 1 ? "" : "es"}, so it can’t be deleted. Set it to cancelled instead.`, 409);
    }
    await prisma.match.delete({ where: { id } });
    refreshAll();
    return { ok: true, message: `Game #${match.gameNumber} deleted` };
  });
}
