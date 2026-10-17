import { cache } from "react";
import prisma from "@/lib/prisma";
import { computeStandings } from "@/lib/standings";
import { fullName } from "@/lib/format";
import { listTeams } from "./teams";

/**
 * Results that count: matches with a CONFIRMED report. The confirmed report's score is used
 * (the league office confirms one report per match).
 */
async function confirmedResults(seasonId: string, divisionId?: string) {
  const reports = await prisma.matchReport.findMany({
    where: { status: "CONFIRMED", homeScore: { not: null }, awayScore: { not: null }, match: { seasonId, ...(divisionId ? { divisionId } : {}), status: { not: "CANCELLED" } } },
    select: { matchId: true, homeScore: true, awayScore: true, confirmedAt: true, match: { select: { homeTeamId: true, awayTeamId: true } } },
    orderBy: { confirmedAt: "desc" },
  });
  const byMatch = new Map<string, (typeof reports)[number]>();
  for (const r of reports) if (!byMatch.has(r.matchId)) byMatch.set(r.matchId, r);
  return [...byMatch.values()].map((r) => ({ homeTeamId: r.match.homeTeamId, awayTeamId: r.match.awayTeamId, homeScore: r.homeScore!, awayScore: r.awayScore! }));
}

export const loadStandings = cache(async (seasonId: string, divisionId: string) => {
  const [teams, results] = await Promise.all([listTeams(seasonId, divisionId), confirmedResults(seasonId, divisionId)]);
  return computeStandings(teams, results);
});

/** Top scorers from confirmed reports in a division. */
export const topScorers = cache(async (seasonId: string, divisionId: string, take = 5) => {
  const stats = await prisma.playerMatchStat.groupBy({
    by: ["playerId"],
    where: { report: { status: "CONFIRMED", match: { seasonId, divisionId } } },
    _sum: { goals: true, assists: true },
    orderBy: [{ _sum: { goals: "desc" } }, { _sum: { assists: "desc" } }],
    take: take * 2,
  });
  const players = await prisma.player.findMany({
    where: { id: { in: stats.map((s) => s.playerId) } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      teamMemberships: { where: { leftAt: null, membershipType: "SEASONAL", team: { seasonId, divisionId } }, select: { team: { select: { id: true, name: true, color: true, shortName: true } } }, take: 1 },
    },
  });
  const byId = new Map(players.map((p) => [p.id, p]));
  return stats
    .filter((s) => (s._sum.goals ?? 0) > 0)
    .slice(0, take)
    .map((s) => {
      const p = byId.get(s.playerId)!;
      return { playerId: s.playerId, name: fullName(p), team: p.teamMemberships[0]?.team ?? null, goals: s._sum.goals ?? 0, assists: s._sum.assists ?? 0 };
    });
});
