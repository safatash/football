import prisma from "@/lib/prisma";
import { now } from "@/lib/clock";
import { TZ, dayKey, fmtDay, fmtShort, fmtTime } from "@/lib/format";
import { CREW, ROLE_LABEL, certState, feeFor, fills, openRoles, worked, type Role } from "@/lib/officials";
import { fieldName } from "@/lib/public";

const divisionFees = { centerRefFee: true, assistantRefFee: true, fourthRefFee: true } as const;
const POSITION: Record<string, string> = { CENTER: "Center", ASSISTANT: "Assistant" };

export const positionsLabel = (p: string[]) => p.map((x) => POSITION[x] ?? x).join(" · ");
export const certDate = (d: Date | null) => (d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "—");

/** Every referee with how many matches they're on this season. */
export async function listReferees(seasonId: string) {
  const [refs, counts] = await Promise.all([
    prisma.referee.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.matchOfficial.groupBy({ by: ["refereeId"], where: { status: { not: "DECLINED" }, match: { seasonId, status: { not: "CANCELLED" } } }, _count: { _all: true } }),
  ]);
  const n = new Map(counts.map((c) => [c.refereeId, c._count._all]));
  const at = now();
  return refs.map((r) => ({ ...r, season: n.get(r.id) ?? 0, cert: certState(r.certExpires, at) }));
}

/** Active referees for the officials picker. */
export async function refereeOptions() {
  return prisma.referee.findMany({ where: { active: true }, select: { id: true, name: true, positions: true }, orderBy: { name: "asc" } });
}

const assignmentInclude = {
  match: {
    select: {
      id: true,
      gameNumber: true,
      scheduledAt: true,
      status: true,
      seasonId: true,
      field: true,
      season: { select: { name: true, isActive: true } },
      division: { select: { name: true, ...divisionFees } },
      venue: { select: { name: true, park: { select: { name: true } } } },
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
  },
} as const;

type AssignmentRow = Awaited<ReturnType<typeof loadAssignments>>[number];
const loadAssignments = (where: Parameters<typeof prisma.matchOfficial.findMany>[0]) => prisma.matchOfficial.findMany({ ...where, include: assignmentInclude });

function toLine(o: AssignmentRow) {
  const m = o.match;
  return {
    id: o.id,
    matchId: m.id,
    gameNumber: m.gameNumber,
    seasonName: m.season.name,
    seasonActive: m.season.isActive,
    date: fmtDay(m.scheduledAt),
    time: fmtTime(m.scheduledAt),
    when: m.scheduledAt,
    match: `${m.homeTeam.name} vs ${m.awayTeam.name}`,
    where: m.venue ? `${m.venue.park.name} · ${fieldName(m.venue.name)}` : (m.field ?? "To be announced"),
    division: m.division?.name ?? "",
    role: ROLE_LABEL[o.role as Role],
    status: o.status,
    matchStatus: m.status,
    fee: feeFor(o, m.division),
    paid: !!o.paidAt,
  };
}

/** A referee with upcoming and past assignments and season totals. */
export async function getReferee(id: string, seasonId: string) {
  const ref = await prisma.referee.findUnique({ where: { id } });
  if (!ref) return null;
  const rows = await loadAssignments({ where: { refereeId: id }, orderBy: { match: { scheduledAt: "asc" } } });
  const at = now();
  const lines = rows.map(toLine);
  const upcoming = lines.filter((l) => l.when >= at && l.matchStatus !== "CANCELLED" && l.matchStatus !== "COMPLETED");
  const past = lines.filter((l) => !upcoming.includes(l)).reverse();
  const season = rows.filter((o) => o.match.seasonId === seasonId && worked(o) && o.match.status !== "CANCELLED");
  const fees = season.map((o) => ({ fee: feeFor(o, o.match.division), paid: !!o.paidAt }));
  return {
    ref,
    cert: certState(ref.certExpires, at),
    upcoming,
    past,
    totals: {
      matches: season.length,
      centers: season.filter((o) => o.role === "CENTER").length,
      earned: fees.reduce((a, f) => a + f.fee, 0),
      paid: fees.filter((f) => f.paid).reduce((a, f) => a + f.fee, 0),
      owed: fees.filter((f) => !f.paid).reduce((a, f) => a + f.fee, 0),
    },
  };
}

/** Monday (Eastern) of the week containing `d`, as YYYY-MM-DD. */
export function weekStartOf(d: Date) {
  const key = dayKey(d);
  const local = new Date(`${key}T12:00:00Z`);
  const dow = (local.getUTCDay() + 6) % 7; // Monday = 0
  return new Date(local.getTime() - dow * 864e5).toISOString().slice(0, 10);
}
export const addDays = (iso: string, n: number) => new Date(new Date(`${iso}T12:00:00Z`).getTime() + n * 864e5).toISOString().slice(0, 10);

/** One week of matches (all seasons), by day and field, with each crew slot filled or open. */
export async function assignmentsBoard(weekStart: string, missingOnly: boolean) {
  const from = new Date(`${weekStart}T04:00:00Z`);
  const to = new Date(from.getTime() + 7 * 864e5);
  const matches = await prisma.match.findMany({
    where: { scheduledAt: { gte: from, lt: to }, status: { not: "CANCELLED" } },
    select: {
      id: true,
      gameNumber: true,
      scheduledAt: true,
      status: true,
      field: true,
      season: { select: { name: true, isActive: true } },
      division: { select: { name: true } },
      venue: { select: { name: true, park: { select: { name: true } } } },
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
      officials: { select: { role: true, status: true, referee: { select: { id: true, name: true } } } },
    },
    orderBy: [{ scheduledAt: "asc" }, { gameNumber: "asc" }],
  });
  const rows = matches
    .map((m) => ({
      ...m,
      day: dayKey(m.scheduledAt),
      dayLabel: fmtDay(m.scheduledAt),
      time: fmtTime(m.scheduledAt),
      where: m.venue ? `${m.venue.park.name} · ${fieldName(m.venue.name)}` : (m.field ?? "Field to be announced"),
      slots: [...CREW, "FOURTH" as Role].map((role) => {
        const o = m.officials.find((x) => x.role === role && fills(x));
        return { role, label: ROLE_LABEL[role], name: o?.referee.name ?? null, refereeId: o?.referee.id ?? null, status: o?.status ?? null };
      }),
      open: openRoles(m.officials),
    }))
    .filter((m) => !missingOnly || m.open.length);
  const days = [...new Set(rows.map((r) => r.day))].map((day) => {
    const list = rows.filter((r) => r.day === day);
    return { day, label: list[0].dayLabel, matches: list.sort((a, b) => a.where.localeCompare(b.where) || a.scheduledAt.getTime() - b.scheduledAt.getTime()) };
  });
  return { days, total: matches.length, missing: matches.filter((m) => openRoles(m.officials).length).length, openSlots: matches.reduce((a, m) => a + openRoles(m.officials).length, 0) };
}

/** Pay per referee for matches between `from` and `to` (inclusive, Eastern dates). */
export async function payReport(from: string, to: string) {
  const start = new Date(`${from}T04:00:00Z`);
  const end = new Date(new Date(`${to}T04:00:00Z`).getTime() + 864e5);
  const rows = await loadAssignments({
    where: { status: { in: ["ASSIGNED", "CONFIRMED"] }, match: { scheduledAt: { gte: start, lt: end }, status: { not: "CANCELLED" } } },
    orderBy: { match: { scheduledAt: "asc" } },
  });
  const refs = await prisma.referee.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.refereeId))] } }, select: { id: true, name: true, email: true } });
  return refs
    .map((ref) => {
      const lines = rows.filter((r) => r.refereeId === ref.id).map(toLine);
      const owed = lines.filter((l) => !l.paid).reduce((a, l) => a + l.fee, 0);
      const paid = lines.filter((l) => l.paid).reduce((a, l) => a + l.fee, 0);
      return { ...ref, lines, matches: lines.length, owed, paid, total: owed + paid };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Upcoming matches (next `days` days) whose crew isn't full. */
export async function crewGaps(seasonId: string, days = 14) {
  const at = now();
  const matches = await prisma.match.findMany({
    where: { seasonId, scheduledAt: { gte: at, lt: new Date(at.getTime() + days * 864e5) }, status: { in: ["SCHEDULED", "POSTPONED"] } },
    select: { id: true, gameNumber: true, scheduledAt: true, homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } }, officials: { select: { role: true, status: true } } },
    orderBy: { scheduledAt: "asc" },
  });
  return matches
    .map((m) => ({ ...m, open: openRoles(m.officials), when: `${fmtShort(m.scheduledAt)} ${fmtTime(m.scheduledAt)}` }))
    .filter((m) => m.open.length);
}

export const fmtDateEastern = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });
