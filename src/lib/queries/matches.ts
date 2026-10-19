import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { now } from "@/lib/clock";
import { dayKey, fmtDay, fmtTime } from "@/lib/format";
import { fieldPlace, placeLabel } from "@/lib/public";
import { crewNames, openRoles } from "@/lib/officials";
import { teamSelect } from "./teams";

export const matchSelect = {
  id: true,
  seasonId: true,
  gameNumber: true,
  scheduledAt: true,
  endTime: true,
  field: true,
  venue: { select: { name: true, park: { select: { name: true, address: true, city: true, state: true, zip: true, mapUrl: true, notes: true } } } },
  status: true,
  homeScore: true,
  awayScore: true,
  officials: { select: { role: true, status: true, referee: { select: { id: true, name: true } } } },
  reportStatus: true,
  division: { select: { id: true, code: true, name: true } },
  homeTeam: { select: teamSelect },
  awayTeam: { select: teamSelect },
} satisfies Prisma.MatchSelect;
type MatchRow = Prisma.MatchGetPayload<{ select: typeof matchSelect }>;

export function toMatchView(m: MatchRow) {
  const refs = crewNames(m.officials);
  const place = m.venue ? fieldPlace(m.venue) : null;
  return {
    ...m,
    /** "Wakefield Park · Field 3 · Annandale" (or the stored label for matches without a field row) */
    field: place ? placeLabel(place) : m.field,
    place,
    date: fmtDay(m.scheduledAt),
    time: fmtTime(m.scheduledAt),
    day: dayKey(m.scheduledAt),
    refs,
    refsAssigned: refs.filter(Boolean).length,
    openRoles: openRoles(m.officials),
    score: m.homeScore != null && m.awayScore != null ? ([m.homeScore, m.awayScore] as [number, number]) : null,
  };
}
export type MatchView = ReturnType<typeof toMatchView>;

export const listMatches = cache(async (seasonId: string, opts: { teamId?: string; divisionId?: string } = {}) => {
  const rows = await db.match.findMany({
    where: {
      seasonId,
      ...(opts.divisionId ? { divisionId: opts.divisionId } : {}),
      ...(opts.teamId ? { OR: [{ homeTeamId: opts.teamId }, { awayTeamId: opts.teamId }] } : {}),
    },
    select: matchSelect,
    orderBy: [{ scheduledAt: "asc" }, { gameNumber: "asc" }],
  });
  return rows.map(toMatchView);
});

export async function getMatchByGameNumber(seasonId: string, gameNumber: number) {
  if (!Number.isInteger(gameNumber)) return null;
  const m = await db.match.findUnique({ where: { seasonId_gameNumber: { seasonId, gameNumber } }, select: matchSelect });
  return m ? toMatchView(m) : null;
}

/** A game number (e.g. "204") or a match id. */
export async function findMatch(ref: string, seasonId?: string) {
  const n = Number(ref);
  if (seasonId && Number.isInteger(n) && n > 0) return getMatchByGameNumber(seasonId, n);
  const m = await db.match.findFirst({
    where: Number.isInteger(n) && n > 0 ? { gameNumber: n } : { id: ref },
    select: matchSelect,
    orderBy: { season: { startDate: "desc" } },
  });
  return m ? toMatchView(m) : null;
}

/** Upcoming = scheduled and not yet started. */
export const isUpcoming = (m: { status: string; scheduledAt: Date }, at = now()) => m.status === "SCHEDULED" && m.scheduledAt > at;

/** Matches on the next match day (today if there are games today). */
export function nextMatchDay(matches: MatchView[], at = now()) {
  const today = dayKey(at);
  const next = matches.filter((m) => m.status !== "CANCELLED" && m.day >= today).sort((a, b) => +a.scheduledAt - +b.scheduledAt)[0];
  if (!next) return { day: null as string | null, matches: [] as MatchView[] };
  return { day: next.day, matches: matches.filter((m) => m.day === next.day) };
}

/** A team's next scheduled match. */
export async function nextMatchFor(teamId: string, seasonId: string) {
  const m = await db.match.findFirst({
    where: { seasonId, status: "SCHEDULED", scheduledAt: { gt: now() }, OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
    select: matchSelect,
    orderBy: { scheduledAt: "asc" },
  });
  return m ? toMatchView(m) : null;
}

/** Reports are overdue 48 hours after kickoff if the team hasn't submitted. */
export const REPORT_GRACE_MS = 48 * 3600_000;
export const reportOverdue = (scheduledAt: Date, status: string, at = now()) =>
  (status === "NOT_STARTED" || status === "DRAFT") && at.getTime() - scheduledAt.getTime() > REPORT_GRACE_MS;
