import { cache } from "react";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { now } from "@/lib/clock";
import { fullName } from "@/lib/format";

export const teamSelect = {
  id: true,
  code: true,
  name: true,
  shortName: true,
  color: true,
  homeField: true,
  maxPlayers: true,
  status: true,
  seasonId: true,
  division: { select: { id: true, code: true, name: true, rosterMin: true, rosterMax: true } },
} satisfies Prisma.TeamSelect;
export type TeamRef = Prisma.TeamGetPayload<{ select: typeof teamSelect }>;

/** Active seasonal membership (not game pass). */
export const seasonalWhere = { leftAt: null, membershipType: "SEASONAL" } satisfies Prisma.TeamRosterWhereInput;

/** Game-pass memberships that are still valid; expired passes never show in roster pools. */
export const activePassWhere = (at = now()) =>
  ({ membershipType: "GAME_PASS", leftAt: null, gamePass: { status: "ACTIVE", validUntil: { gt: at } } }) satisfies Prisma.TeamRosterWhereInput;

export type TeamSummary = TeamRef & { rosterSize: number; captains: string[] };

export const listTeams = cache(async (seasonId: string, divisionId?: string): Promise<TeamSummary[]> => {
  const teams = await prisma.team.findMany({
    where: { seasonId, ...(divisionId ? { divisionId } : {}) },
    select: {
      ...teamSelect,
      _count: { select: { roster: { where: seasonalWhere } } },
      roster: { where: { ...seasonalWhere, isCaptain: true }, select: { player: { select: { firstName: true, lastName: true } } } },
    },
    orderBy: [{ division: { displayOrder: "asc" } }, { name: "asc" }],
  });
  return teams.map(({ _count, roster, ...t }) => ({ ...t, rosterSize: _count.roster, captains: roster.map((r) => fullName(r.player)) }));
});

/** A team by id or by its code within a season. */
export async function getTeam(idOrCode: string, seasonId?: string) {
  return prisma.team.findFirst({
    where: seasonId ? { seasonId, OR: [{ id: idOrCode }, { code: idOrCode }] } : { OR: [{ id: idOrCode }, { code: idOrCode }] },
    select: teamSelect,
    orderBy: { createdAt: "desc" },
  });
}

const memberSelect = {
  id: true,
  jerseyNumber: true,
  isCaptain: true,
  lineupStatus: true,
  membershipType: true,
  matchId: true,
  player: { select: { id: true, firstName: true, lastName: true, position: true, status: true, user: { select: { email: true } } } },
  gamePass: { select: { id: true, status: true, validUntil: true, matchId: true } },
} satisfies Prisma.TeamRosterSelect;

const toMember = ({ gamePass, ...r }: Prisma.TeamRosterGetPayload<{ select: typeof memberSelect }>) => ({
  ...r,
  name: fullName(r.player),
  suspended: r.player.status === "SUSPENDED",
  gamePass: r.membershipType === "GAME_PASS",
  pass: gamePass,
});
export type RosterMember = ReturnType<typeof toMember>;

const byJersey = (a: { jerseyNumber: number | null; name: string }, b: { jerseyNumber: number | null; name: string }) =>
  (a.jerseyNumber ?? 999) - (b.jerseyNumber ?? 999) || a.name.localeCompare(b.name);

/** Season roster of a team, ordered by jersey. */
export async function teamRoster(teamId: string) {
  const rows = await prisma.teamRoster.findMany({ where: { teamId, ...seasonalWhere }, select: memberSelect });
  return rows.map(toMember).sort(byJersey);
}

/** Match-roster pool: season roster plus active game-pass players for that match only. */
export async function matchPool(teamId: string, matchId: string) {
  const rows = await prisma.teamRoster.findMany({
    where: { teamId, OR: [seasonalWhere, { ...activePassWhere(), matchId }] },
    select: memberSelect,
  });
  return rows.map(toMember).sort((a, b) => Number(a.gamePass) - Number(b.gamePass) || byJersey(a, b));
}
export type PoolMember = Awaited<ReturnType<typeof matchPool>>[number];
