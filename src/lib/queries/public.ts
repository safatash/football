/**
 * Read-only queries for the public league pages. Each page uses a fixed number of queries (no
 * per-row lookups), and they never select contact details, dates of birth or addresses.
 */
import { cache } from "react";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { now } from "@/lib/clock";
import { dayKey, fmtDay, fmtTime, TZ } from "@/lib/format";
import { divisionSelect } from "./admin-league";
import type { SeasonRef } from "./season";
import { seasonalWhere } from "./teams";

/* ------------------------------------------------------------------ */
/* Seasons                                                             */
/* ------------------------------------------------------------------ */

export type PublicSeason = SeasonRef & { slug: string };

const seasonFields = { id: true, name: true, slug: true, isActive: true, startDate: true, endDate: true } satisfies Prisma.SeasonSelect;

export const publicSeasons = cache(async (): Promise<PublicSeason[]> =>
  prisma.season.findMany({ select: seasonFields, orderBy: { startDate: "desc" } }),
);

/** `?season=` slug (or legacy datasource), defaulting to the active season. */
export async function resolvePublicSeason(slug?: string | null) {
  const seasons = await publicSeasons();
  const active = seasons.find((s) => s.isActive) ?? seasons[0] ?? null;
  const wanted = slug?.trim().toLowerCase();
  const picked = (wanted && seasons.find((s) => s.slug === wanted)) || active;
  return { season: picked, active, seasons, unknown: !!wanted && picked?.slug !== wanted };
}

/** Keeps the selected season in links (omitted for the active season). */
export const withSeasonParam = (href: string, season: PublicSeason | null, active: PublicSeason | null) =>
  season && active && season.id !== active.id ? `${href}${href.includes("?") ? "&" : "?"}season=${season.slug}` : href;

/* ------------------------------------------------------------------ */
/* Matches                                                             */
/* ------------------------------------------------------------------ */

const publicTeam = { id: true, name: true, shortName: true, color: true, logoUrl: true, code: true } satisfies Prisma.TeamSelect;
export type PublicTeamRef = Prisma.TeamGetPayload<{ select: typeof publicTeam }>;

const publicMatchSelect = {
  id: true,
  gameNumber: true,
  scheduledAt: true,
  status: true,
  reportStatus: true,
  homeScore: true,
  awayScore: true,
  field: true,
  location: true,
  ref1: true,
  ref2: true,
  ref3: true,
  seasonId: true,
  division: { select: { id: true, code: true, name: true } },
  venue: { select: { complex: true, name: true, address: true, city: true, state: true, zip: true } },
  homeTeam: { select: publicTeam },
  awayTeam: { select: publicTeam },
} satisfies Prisma.MatchSelect;

function toPublicMatch(m: Prisma.MatchGetPayload<{ select: typeof publicMatchSelect }>) {
  const played = m.status === "COMPLETED" && m.homeScore != null && m.awayScore != null;
  return {
    ...m,
    played,
    confirmed: played && m.reportStatus === "CONFIRMED",
    date: m.scheduledAt.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric", timeZone: TZ }),
    day: m.scheduledAt.toLocaleDateString("en-US", { weekday: "short", timeZone: TZ }),
    dayKey: dayKey(m.scheduledAt),
    dayLabel: fmtDay(m.scheduledAt),
    time: fmtTime(m.scheduledAt),
  };
}
export type PublicMatch = ReturnType<typeof toPublicMatch>;

export type MatchFilters = { divisionCode?: string; teamId?: string; q?: string };

/** Results (played, newest first) or schedule (upcoming, soonest first) in one query. */
export async function listPublicMatches(seasonId: string, kind: "results" | "schedule" | "all", f: MatchFilters = {}) {
  const q = f.q?.trim();
  const gameNumber = q && /^#?\d+$/.test(q) ? Number(q.replace("#", "")) : null;
  const where: Prisma.MatchWhereInput = {
    seasonId,
    status: kind === "results" ? "COMPLETED" : kind === "schedule" ? "SCHEDULED" : { not: "CANCELLED" },
    ...(kind === "results" ? { homeScore: { not: null }, awayScore: { not: null } } : {}),
    ...(kind === "schedule" ? { scheduledAt: { gte: now() } } : {}),
    ...(f.divisionCode ? { division: { code: f.divisionCode } } : {}),
    ...(f.teamId ? { OR: [{ homeTeamId: f.teamId }, { awayTeamId: f.teamId }] } : {}),
    ...(q
      ? {
          AND: [
            {
              OR: [
                { homeTeam: { name: { contains: q, mode: "insensitive" } } },
                { awayTeam: { name: { contains: q, mode: "insensitive" } } },
                { field: { contains: q, mode: "insensitive" } },
                ...(gameNumber != null ? [{ gameNumber }] : []),
              ],
            },
          ],
        }
      : {}),
  };
  const rows = await prisma.match.findMany({
    where,
    select: publicMatchSelect,
    orderBy: kind === "results" ? [{ scheduledAt: "desc" }, { gameNumber: "desc" }] : [{ scheduledAt: "asc" }, { gameNumber: "asc" }],
  });
  return rows.map(toPublicMatch);
}

/** One match by id, or by game number within a season. */
export async function getPublicMatch(ref: string, seasonId?: string) {
  const n = /^\d+$/.test(ref) ? Number(ref) : null;
  const m =
    n != null && seasonId
      ? await prisma.match.findUnique({ where: { seasonId_gameNumber: { seasonId, gameNumber: n } }, select: publicMatchSelect })
      : await prisma.match.findUnique({ where: { id: ref }, select: publicMatchSelect });
  return m ? toPublicMatch(m) : null;
}

/* ------------------------------------------------------------------ */
/* Teams                                                               */
/* ------------------------------------------------------------------ */

export const publicTeamSelect = {
  ...publicTeam,
  seasonId: true,
  photoUrl: true,
  homeShirt: true,
  homeShorts: true,
  awayShirt: true,
  awayShorts: true,
  formation: true,
  homeField: true,
  season: { select: seasonFields },
  division: { select: { id: true, code: true, name: true, level: true } },
} satisfies Prisma.TeamSelect;

export async function getPublicTeam(teamId: string) {
  return prisma.team.findUnique({ where: { id: teamId }, select: publicTeamSelect });
}

/** The same club in another season: matched by code, then by name. */
export async function teamInSeason(team: { code: string | null; name: string }, seasonId: string) {
  return prisma.team.findFirst({
    where: { seasonId, OR: [...(team.code ? [{ code: team.code }] : []), { name: { equals: team.name, mode: "insensitive" } }] },
    select: { id: true },
  });
}

/** Captain names only (never contact details). */
export async function teamCaptains(teamId: string) {
  const rows = await prisma.teamRoster.findMany({
    where: { teamId, ...seasonalWhere, isCaptain: true },
    select: { player: { select: { firstName: true, lastName: true } } },
    orderBy: { joinedAt: "asc" },
  });
  return rows.map((r) => `${r.player.firstName} ${r.player.lastName}`.trim());
}

type StatTotals = { goals: number; assists: number; yellow: number; red: number; gp: number };
const emptyTotals = (): StatTotals => ({ goals: 0, assists: 0, yellow: 0, red: 0, gp: 0 });

/**
 * Per-player totals from confirmed reports, grouped by player and team in one query.
 * Yellow counts both yellows (first and second); GP counts games the player was in.
 */
async function statTotals(where: Prisma.Sql) {
  const rows = await prisma.$queryRaw<{ playerId: string; teamId: string; goals: bigint; assists: bigint; yellow: bigint; red: bigint; gp: bigint }[]>(Prisma.sql`
    SELECT s."playerId", r."teamId",
           SUM(s."goals") AS "goals", SUM(s."assists") AS "assists",
           SUM(s."yellow" + s."secondYellow") AS "yellow", SUM(s."red") AS "red",
           COUNT(*) FILTER (WHERE s."inGame" <> 'DNP') AS "gp"
    FROM "player_match_stats" s
    JOIN "match_reports" r ON r."id" = s."reportId"
    JOIN "matches" m ON m."id" = r."matchId"
    WHERE r."status" = 'CONFIRMED' AND ${where}
    GROUP BY s."playerId", r."teamId"
  `);
  return rows.map((r) => ({ playerId: r.playerId, teamId: r.teamId, goals: Number(r.goals), assists: Number(r.assists), yellow: Number(r.yellow), red: Number(r.red), gp: Number(r.gp) }));
}

/** Approved, active season roster with this season's stats for the team. Game-pass players never appear. */
export async function teamRosterWithStats(teamId: string) {
  const [rows, totals] = await Promise.all([
    prisma.teamRoster.findMany({
      where: { teamId, ...seasonalWhere, player: { finalApproval: "APPROVED", status: { not: "INACTIVE" } } },
      select: {
        id: true,
        jerseyNumber: true,
        isCaptain: true,
        player: { select: { id: true, firstName: true, lastName: true, position: true, photoUrl: true, social: true } },
      },
    }),
    statTotals(Prisma.sql`r."teamId" = ${teamId}`),
  ]);
  const byPlayer = new Map(totals.map((t) => [t.playerId, t]));
  return rows
    .map((r) => ({
      id: r.id,
      playerId: r.player.id,
      name: `${r.player.firstName} ${r.player.lastName}`.trim(),
      firstName: r.player.firstName,
      jersey: r.jerseyNumber,
      captain: r.isCaptain,
      position: r.player.position,
      photoUrl: r.player.social ? r.player.photoUrl : null,
      ...(byPlayer.get(r.player.id) ?? emptyTotals()),
    }))
    .sort((a, b) => (a.jersey ?? 999) - (b.jersey ?? 999) || a.name.localeCompare(b.name));
}
export type RosterRow = Awaited<ReturnType<typeof teamRosterWithStats>>[number];

/* ------------------------------------------------------------------ */
/* Players                                                             */
/* ------------------------------------------------------------------ */

/** Public player profile: name, position, photo (only with consent), current team and history. */
export async function publicPlayer(playerId: string, activeSeasonId: string | null) {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      position: true,
      photoUrl: true,
      social: true,
      teamMemberships: {
        where: { membershipType: "SEASONAL" },
        select: {
          leftAt: true,
          jerseyNumber: true,
          isCaptain: true,
          team: { select: { ...publicTeam, season: { select: seasonFields }, division: { select: { code: true, name: true } } } },
        },
      },
    },
  });
  if (!player) return null;
  const totals = await statTotals(Prisma.sql`s."playerId" = ${playerId}`);
  const history = player.teamMemberships
    .map((m) => ({ ...m, stats: totals.find((t) => t.teamId === m.team.id) ?? emptyTotals() }))
    .sort((a, b) => +b.team.season.startDate - +a.team.season.startDate || a.team.name.localeCompare(b.team.name));
  const current = history.find((h) => h.team.season.id === activeSeasonId && !h.leftAt) ?? null;
  return {
    id: player.id,
    name: `${player.firstName} ${player.lastName}`.trim(),
    firstName: player.firstName,
    position: player.position,
    photoUrl: player.social ? player.photoUrl : null,
    current,
    history,
  };
}

/* ------------------------------------------------------------------ */
/* Divisions                                                           */
/* ------------------------------------------------------------------ */

export async function publicDivision(seasonId: string, code: string) {
  return prisma.division.findUnique({
    where: { seasonId_code: { seasonId, code } },
    select: divisionSelect,
  });
}

export async function divisionsOf(seasonId: string) {
  return prisma.division.findMany({ where: { seasonId }, select: { id: true, code: true, name: true }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }] });
}

/** Player stats for a division (25 a page), one query for the page and one for the count. */
export async function divisionPlayerStats(seasonId: string, divisionId: string, page: number, perPage = 25) {
  const where = Prisma.sql`m."seasonId" = ${seasonId} AND m."divisionId" = ${divisionId}`;
  const [rows, count] = await Promise.all([
    prisma.$queryRaw<{ playerId: string; firstName: string; lastName: string; teamId: string; teamName: string; goals: bigint; assists: bigint; yellow: bigint; red: bigint; gp: bigint }[]>(Prisma.sql`
      SELECT s."playerId", p."firstName", p."lastName", r."teamId", t."name" AS "teamName",
             SUM(s."goals") AS "goals", SUM(s."assists") AS "assists",
             SUM(s."yellow" + s."secondYellow") AS "yellow", SUM(s."red") AS "red",
             COUNT(*) FILTER (WHERE s."inGame" <> 'DNP') AS "gp"
      FROM "player_match_stats" s
      JOIN "match_reports" r ON r."id" = s."reportId"
      JOIN "matches" m ON m."id" = r."matchId"
      JOIN "players" p ON p."id" = s."playerId"
      JOIN "teams" t ON t."id" = r."teamId"
      WHERE r."status" = 'CONFIRMED' AND ${where}
      GROUP BY s."playerId", p."firstName", p."lastName", r."teamId", t."name"
      ORDER BY SUM(s."goals") DESC, SUM(s."assists") DESC, p."lastName" ASC, p."firstName" ASC
      LIMIT ${perPage} OFFSET ${(page - 1) * perPage}
    `),
    prisma.$queryRaw<{ n: bigint }[]>(Prisma.sql`
      SELECT COUNT(*) AS "n" FROM (
        SELECT 1 FROM "player_match_stats" s
        JOIN "match_reports" r ON r."id" = s."reportId"
        JOIN "matches" m ON m."id" = r."matchId"
        WHERE r."status" = 'CONFIRMED' AND ${where}
        GROUP BY s."playerId", r."teamId"
      ) x
    `),
  ]);
  return {
    total: Number(count[0]?.n ?? 0),
    rows: rows.map((r) => ({
      playerId: r.playerId,
      name: `${r.firstName} ${r.lastName}`.trim(),
      teamId: r.teamId,
      teamName: r.teamName,
      goals: Number(r.goals),
      assists: Number(r.assists),
      yellow: Number(r.yellow),
      red: Number(r.red),
      gp: Number(r.gp),
    })),
  };
}

/* ------------------------------------------------------------------ */
/* Match report                                                        */
/* ------------------------------------------------------------------ */

/**
 * Per-team player lines for a match from its confirmed (or, failing that, submitted) report.
 * Drafts never show publicly.
 */
export async function publicMatchReport(matchId: string, teamIds: string[]) {
  const reports = await prisma.matchReport.findMany({
    where: { matchId, teamId: { in: teamIds }, status: { in: ["CONFIRMED", "SUBMITTED"] } },
    select: {
      teamId: true,
      status: true,
      stats: {
        select: { goals: true, assists: true, yellow: true, secondYellow: true, red: true, inGame: true, note: true, player: { select: { id: true, firstName: true, lastName: true } } },
      },
    },
  });
  const jerseys = await prisma.teamRoster.findMany({
    where: { teamId: { in: teamIds }, OR: [{ membershipType: "SEASONAL" }, { matchId }], player: { id: { in: reports.flatMap((r) => r.stats.map((s) => s.player.id)) } } },
    select: { teamId: true, jerseyNumber: true, playerId: true },
  });
  const jersey = (teamId: string, playerId: string) => jerseys.find((j) => j.teamId === teamId && j.playerId === playerId)?.jerseyNumber ?? null;
  return Object.fromEntries(
    reports.map((r) => [
      r.teamId,
      {
        status: r.status,
        lines: r.stats
          .map((s) => ({ ...s, name: `${s.player.firstName} ${s.player.lastName}`.trim(), playerId: s.player.id, jersey: jersey(r.teamId, s.player.id) }))
          .sort((a, b) => (a.jersey ?? 999) - (b.jersey ?? 999) || a.name.localeCompare(b.name)),
      },
    ]),
  ) as Record<string, { status: string; lines: { playerId: string; name: string; jersey: number | null; goals: number; assists: number; yellow: number; secondYellow: number; red: number; inGame: string; note: string | null }[] }>;
}
