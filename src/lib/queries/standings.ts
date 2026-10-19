import { cache } from "react";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { computeStandings, type StandingRow } from "@/lib/standings";
import { listDivisions, type DivisionRow } from "./admin-league";
import { listTeams, type TeamSummary } from "./teams";

/**
 * Results that count: completed matches with both scores that the league office has confirmed
 * (imported results from the old site are stored as confirmed). One query per season.
 */
const resultsWhere = (seasonId: string, divisionId?: string) =>
  ({
    seasonId,
    ...(divisionId ? { divisionId } : {}),
    status: "COMPLETED",
    reportStatus: "CONFIRMED",
    homeScore: { not: null },
    awayScore: { not: null },
  }) satisfies Prisma.MatchWhereInput;

async function confirmedResults(seasonId: string, divisionId?: string) {
  const rows = await prisma.match.findMany({
    where: resultsWhere(seasonId, divisionId),
    select: { homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true },
  });
  return rows.map((r) => ({ homeTeamId: r.homeTeamId, awayTeamId: r.awayTeamId, homeScore: r.homeScore!, awayScore: r.awayScore! }));
}

export const loadStandings = cache(async (seasonId: string, divisionId: string) => {
  const [teams, results] = await Promise.all([listTeams(seasonId, divisionId), confirmedResults(seasonId, divisionId)]);
  return computeStandings(teams, results);
});

export type DivisionStandings = { division: DivisionRow; rows: StandingRow<TeamSummary>[]; teams: number; completed: number };

/**
 * Every division of a season in display order, with its table and how many confirmed results it
 * is based on. Divisions without teams or results are included (the page shows an empty state).
 * The admin Standings page and the division page's Standings tab both read this.
 */
export const standingsByDivision = cache(async (seasonId: string): Promise<DivisionStandings[]> => {
  const [divisions, teams, results] = await Promise.all([listDivisions(seasonId), listTeams(seasonId), confirmedResults(seasonId)]);
  return divisions.map((division) => {
    const divTeams = teams.filter((t) => t.division.id === division.id);
    const ids = new Set(divTeams.map((t) => t.id));
    const counted = results.filter((r) => ids.has(r.homeTeamId) && ids.has(r.awayTeamId));
    return { division, rows: computeStandings(divTeams, counted), teams: divTeams.length, completed: counted.length };
  });
});

/** Standings for every division in a season, in display order (two queries in total). */
export const loadSeasonStandings = cache(async (seasonId: string) => {
  const [teams, results] = await Promise.all([listTeams(seasonId), confirmedResults(seasonId)]);
  const byDivision = new Map<string, { division: TeamSummary["division"]; rows: StandingRow<TeamSummary>[] }>();
  for (const t of teams) if (!byDivision.has(t.division.id)) byDivision.set(t.division.id, { division: t.division, rows: [] });
  for (const [id, entry] of byDivision) {
    const divTeams = teams.filter((t) => t.division.id === id);
    const ids = new Set(divTeams.map((t) => t.id));
    entry.rows = computeStandings(
      divTeams,
      results.filter((r) => ids.has(r.homeTeamId) && ids.has(r.awayTeamId)),
    );
  }
  return [...byDivision.values()];
});

export type Leader = {
  playerId: string;
  name: string;
  firstName: string;
  photoUrl: string | null;
  team: { id: string; name: string; color: string | null; shortName: string | null } | null;
  goals: number;
  assists: number;
  divisionId: string;
};

/**
 * Season leaders from confirmed reports, one query: totals per player and division, with the
 * team they played for. Photos only when the player allows it (`social`).
 */
export const seasonLeaders = cache(async (seasonId: string) => {
  const rows = await prisma.$queryRaw<
    {
      playerId: string;
      firstName: string;
      lastName: string;
      photoUrl: string | null;
      social: boolean;
      divisionId: string;
      teamId: string;
      teamName: string;
      color: string | null;
      shortName: string | null;
      goals: bigint;
      assists: bigint;
    }[]
  >(Prisma.sql`
    SELECT s."playerId", p."firstName", p."lastName", p."photoUrl", p."social",
           m."divisionId", r."teamId", t."name" AS "teamName", t."color", t."shortName",
           SUM(s."goals") AS "goals", SUM(s."assists") AS "assists"
    FROM "player_match_stats" s
    JOIN "match_reports" r ON r."id" = s."reportId"
    JOIN "matches" m ON m."id" = r."matchId"
    JOIN "players" p ON p."id" = s."playerId"
    JOIN "teams" t ON t."id" = r."teamId"
    WHERE m."seasonId" = ${seasonId} AND r."status" = 'CONFIRMED' AND m."divisionId" IS NOT NULL
    GROUP BY s."playerId", p."firstName", p."lastName", p."photoUrl", p."social", m."divisionId", r."teamId", t."name", t."color", t."shortName"
  `);
  return rows.map<Leader>((r) => ({
    playerId: r.playerId,
    name: `${r.firstName} ${r.lastName}`.trim(),
    firstName: r.firstName,
    photoUrl: r.social ? r.photoUrl : null,
    team: { id: r.teamId, name: r.teamName, color: r.color, shortName: r.shortName },
    goals: Number(r.goals),
    assists: Number(r.assists),
    divisionId: r.divisionId,
  }));
});

/** Top N by goals (or assists), ties broken by the other stat, then name. Players with 0 are left out. */
export function topBy(leaders: Leader[], key: "goals" | "assists", n: number) {
  const other = key === "goals" ? "assists" : "goals";
  return leaders
    .filter((l) => l[key] > 0)
    .sort((a, b) => b[key] - a[key] || b[other] - a[other] || a.name.localeCompare(b.name))
    .slice(0, n);
}

/** Top scorers in a division (admin division page). */
export const topScorers = cache(async (seasonId: string, divisionId: string, take = 5) => {
  const leaders = (await seasonLeaders(seasonId)).filter((l) => l.divisionId === divisionId);
  return topBy(leaders, "goals", take).map((l) => ({ playerId: l.playerId, name: l.name, team: l.team, goals: l.goals, assists: l.assists }));
});
