import { cache } from "react";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { now } from "@/lib/clock";
import { fmtShort, fullName, relativeDay } from "@/lib/format";
import { getTeamAccess } from "@/lib/team-access";
import { getMatchByGameNumber, matchSelect, nextMatchFor, toMatchView, type MatchView } from "./matches";
import { matchPool, teamRoster, type RosterMember } from "./teams";

/** Per-request cached team access (layout and page both ask). */
export const teamAccess = cache((teamId: string) => getTeamAccess(teamId));

export const seasonName = cache(async (seasonId: string) => {
  const s = await prisma.season.findUnique({ where: { id: seasonId }, select: { name: true } });
  return s?.name ?? "";
});

/** The team's next scheduled match (cached per request). */
export const nextTeamMatch = cache((teamId: string, seasonId: string) => nextMatchFor(teamId, seasonId));

/**
 * The match a captain should report on: the most recent completed match whose team report
 * isn't submitted or confirmed yet, otherwise the most recent completed match.
 */
export const reportMatchFor = cache(async (teamId: string, seasonId: string) => {
  const rows = await prisma.match.findMany({
    where: { seasonId, status: "COMPLETED", OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
    select: { ...matchSelect, reports: { where: { teamId }, select: { status: true } } },
    orderBy: { scheduledAt: "desc" },
  });
  const done = (s?: string) => s === "SUBMITTED" || s === "CONFIRMED";
  const pick = rows.find((r) => !done(r.reports[0]?.status)) ?? rows[0];
  if (!pick) return null;
  const { reports, ...m } = pick;
  return { match: toMatchView(m), status: reports[0]?.status ?? ("NOT_STARTED" as const) };
});

/** A match by game number in the team's season; null unless the team plays in it. */
export async function teamMatch(teamId: string, seasonId: string, gameNumber: string) {
  const n = Number(gameNumber);
  if (!Number.isInteger(n) || n <= 0) return null;
  const m = await getMatchByGameNumber(seasonId, n);
  if (!m || (m.homeTeam.id !== teamId && m.awayTeam.id !== teamId)) return null;
  return m;
}

export const opponentOf = (m: MatchView, teamId: string) => (m.homeTeam.id === teamId ? m.awayTeam : m.homeTeam);

/** GK / DEF / MID / FWD from a free-text position. */
export function posCode(position: string | null | undefined) {
  const p = (position ?? "").trim().toLowerCase();
  if (!p) return "—";
  if (/^(gk|goal|keep)/.test(p)) return "GK";
  if (/(def|back|^cb|^lb|^rb|sweeper)/.test(p)) return "DEF";
  if (/(mid|wing|^cm|^dm|^am|^lm|^rm)/.test(p)) return "MID";
  if (/(forw|strik|fwd|^st$|^cf$|attack)/.test(p)) return "FWD";
  return p.slice(0, 3).toUpperCase();
}

export type Avail = "yes" | "no" | "maybe";

/** A team-roster row prepared for the captain screens (keyed by TeamRoster id). */
export type SquadPlayer = {
  id: string;
  playerId: string;
  name: string;
  jersey: number | null;
  pos: string;
  avail: Avail;
  note: string | null;
  captain: boolean;
  suspended: boolean;
  /** "May 31" when the suspension has an end date. */
  suspendedUntil: string | null;
  gamePass: boolean;
  /** Has a lineup slot on the match roster. */
  starter: boolean;
};

async function availabilityFor(matchId: string, teamRosterIds: string[]) {
  const rows = await prisma.matchAvailability.findMany({
    where: { matchId, teamRosterId: { in: teamRosterIds } },
    select: { teamRosterId: true, status: true, note: true },
  });
  return new Map(
    rows.map((r) => [r.teamRosterId, { avail: (r.status === "AVAILABLE" ? "yes" : r.status === "UNAVAILABLE" ? "no" : "maybe") as Avail, note: r.note }]),
  );
}

/** Active suspensions: playerId → end date (null = until lifted). */
async function suspensionsFor(playerIds: string[]) {
  const at = now();
  const rows = await prisma.suspension.findMany({
    where: { playerId: { in: playerIds }, liftedAt: null, startsAt: { lte: at }, OR: [{ endsAt: null }, { endsAt: { gt: at } }] },
    select: { playerId: true, endsAt: true },
  });
  const out = new Map<string, Date | null>();
  for (const r of rows) {
    const cur = out.get(r.playerId);
    if (cur === null) continue;
    out.set(r.playerId, r.endsAt === null ? null : cur && cur > r.endsAt ? cur : r.endsAt);
  }
  return out;
}

/**
 * Members with availability for a match (no reply = maybe), suspensions and lineup slots.
 * Without a match everyone counts as available.
 */
export async function squadFor(members: RosterMember[], matchId: string | null, slots?: Map<string, string | null>): Promise<SquadPlayer[]> {
  const [avail, susp] = await Promise.all([
    matchId ? availabilityFor(matchId, members.map((m) => m.id)) : Promise.resolve(new Map<string, { avail: Avail; note: string | null }>()),
    suspensionsFor(members.map((m) => m.player.id)),
  ]);
  return members.map((m) => {
    const a = avail.get(m.id) ?? (matchId ? { avail: "maybe" as Avail, note: "No reply yet" } : { avail: "yes" as Avail, note: null });
    const suspended = m.suspended || susp.has(m.player.id);
    const until = susp.get(m.player.id);
    return {
      id: m.id,
      playerId: m.player.id,
      name: m.name,
      jersey: m.jerseyNumber,
      pos: posCode(m.player.position),
      avail: a.avail,
      note: a.note,
      captain: m.isCaptain,
      suspended,
      suspendedUntil: until ? fmtShort(until) : null,
      gamePass: m.gamePass,
      starter: !!slots?.get(m.id) || m.lineupStatus === "STARTING",
    };
  });
}

/** The team's match roster for a match, with its entries' lineup slots. */
export const matchRosterFor = cache((matchId: string, teamId: string) =>
  prisma.matchRoster.findUnique({
    where: { matchId_teamId: { matchId, teamId } },
    select: { id: true, status: true, formation: true, finalizedAt: true, entries: { select: { teamRosterId: true, lineupSlot: true } } },
  }),
);

const sheetMemberSelect = {
  id: true,
  jerseyNumber: true,
  isCaptain: true,
  membershipType: true,
  player: { select: { id: true, firstName: true, lastName: true, position: true } },
} satisfies Prisma.TeamRosterSelect;

/** Match roster entries with their players (for the report and the printed sheet). */
export async function matchRosterPlayers(matchId: string, teamId: string) {
  const r = await prisma.matchRoster.findUnique({
    where: { matchId_teamId: { matchId, teamId } },
    select: { status: true, entries: { select: { lineupSlot: true, teamRoster: { select: sheetMemberSelect } } } },
  });
  if (!r) return null;
  return {
    status: r.status,
    players: r.entries.map((e) => ({
      teamRosterId: e.teamRoster.id,
      playerId: e.teamRoster.player.id,
      name: fullName(e.teamRoster.player),
      jersey: e.teamRoster.jerseyNumber,
      pos: posCode(e.teamRoster.player.position),
      captain: e.teamRoster.isCaptain,
      gamePass: e.teamRoster.membershipType === "GAME_PASS",
      starter: !!e.lineupSlot,
    })),
  };
}

/** The team's own report for a match, with player stats. */
export function teamReport(matchId: string, teamId: string) {
  return prisma.matchReport.findUnique({
    where: { matchId_teamId: { matchId, teamId } },
    select: {
      status: true,
      homeScore: true,
      awayScore: true,
      redCardNote: true,
      stats: { select: { playerId: true, goals: true, assists: true, yellow: true, red: true, player: { select: { firstName: true, lastName: true } } } },
    },
  });
}

/** Everyone who has been on the team on a game pass this season, newest first. */
export async function gamePassMembers(teamId: string, take = 12) {
  const at = now();
  const rows = await prisma.teamRoster.findMany({
    where: { teamId, membershipType: "GAME_PASS" },
    select: {
      id: true,
      jerseyNumber: true,
      leftAt: true,
      player: { select: { firstName: true, lastName: true, position: true } },
      gamePass: { select: { status: true, validUntil: true } },
      match: { select: { gameNumber: true } },
    },
    orderBy: { joinedAt: "desc" },
    take,
  });
  return rows.map((r) => ({
    id: r.id,
    name: fullName(r.player),
    jersey: r.jerseyNumber,
    pos: posCode(r.player.position),
    gameNumber: r.match?.gameNumber ?? null,
    active: !r.leftAt && r.gamePass?.status === "ACTIVE" && r.gamePass.validUntil > at,
  }));
}

/** The team's next match with its match-roster pool prepared for the captain screens. */
export async function nextMatchSquad(teamId: string, seasonId: string) {
  const match = await nextTeamMatch(teamId, seasonId);
  const matchRoster = match ? await matchRosterFor(match.id, teamId) : null;
  const slots = new Map(matchRoster?.entries.map((e) => [e.teamRosterId, e.lineupSlot]) ?? []);
  const members = match ? await matchPool(teamId, match.id) : await teamRoster(teamId);
  const squad = await squadFor(members, match?.id ?? null, slots);
  return { match, matchRoster, squad, season: squad.filter((p) => !p.gamePass), passes: squad.filter((p) => p.gamePass) };
}

/** Who a team update goes to and the suggested message, built from the team's next match. */
export type TeamUpdateInfo = { recipients: number; seasonPlayers: number; gameNumber: number | null; passPlayers: number; message: string };

export function teamUpdateInfo(teamId: string, match: MatchView | null, squad: SquadPlayer[]): TeamUpdateInfo {
  const seasonPlayers = squad.filter((p) => !p.gamePass).length;
  const passPlayers = squad.length - seasonPlayers;
  const day = match ? relativeDay(match.scheduledAt, now()) : "";
  const when = day === "Today" || day === "Tomorrow" ? day.toLowerCase() : day;
  const message = match
    ? `Game #${match.gameNumber} vs ${opponentOf(match, teamId).name}: ${match.field ?? "field to be confirmed"}, ${when} at ${match.time}. Please be there 30 minutes before kickoff.`
    : "";
  return { recipients: squad.length, seasonPlayers, gameNumber: match?.gameNumber ?? null, passPlayers, message };
}
