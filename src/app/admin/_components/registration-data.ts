import prisma from "@/lib/prisma";
import { REGISTRATIONS, division, type RegistrationRow } from "@/lib/league-data";

/** A row in the registration tables, from the database or from the Spring 2026 sample queue. */
export type RegListRow = {
  id: string;
  name: string;
  email: string;
  /** Prisma enum or display label; both work with RegistrationBadge */
  status: string;
  payment: string;
  submitted: string;
  submittedAt: number;
  amount: number;
  division: string;
  preferred: string;
  captainRequest: boolean;
  needsPlacement: boolean;
  isNew: boolean;
  open: boolean;
};

/** selectedTeams / captainRequests are JSON arrays (team ids or names); older rows may be comma-separated. */
export function parseList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const s = raw.trim();
  if (!s) return [];
  try {
    const v: unknown = JSON.parse(s);
    if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
    if (typeof v === "string" || typeof v === "number") return [String(v)];
  } catch {
    /* not JSON */
  }
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

export const shortDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

export function sampleRow(r: RegistrationRow): RegListRow {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    status: r.reg,
    payment: r.pay,
    submitted: r.date,
    submittedAt: Number(r.id.replace(/\D/g, "")),
    amount: r.amount,
    division: division(r.div).name,
    preferred: r.pref,
    captainRequest: r.captainRequest,
    needsPlacement: r.isNew && r.pref === "—",
    isNew: r.isNew,
    open: r.reg === "Submitted" || r.reg === "Pending Review",
  };
}

export const samplePending = () => REGISTRATIONS.filter((r) => r.reg === "Submitted" || r.reg === "Pending Review").map(sampleRow);

type TeamRef = { id: string; name: string; division: { name: string } };

/** Resolves selectedTeams values (ids or names) to teams. */
export async function teamLookup(values: string[]) {
  const uniq = [...new Set(values)];
  const map = new Map<string, TeamRef>();
  if (!uniq.length) return map;
  const teams = await prisma.team.findMany({
    where: { OR: [{ id: { in: uniq } }, { name: { in: uniq } }] },
    select: { id: true, name: true, division: { select: { name: true } } },
  });
  for (const t of teams) {
    map.set(t.id, t);
    if (!map.has(t.name)) map.set(t.name, t);
  }
  return map;
}

/**
 * Registrations from the database, newest first. Filtered to the selected season when a season
 * with that name exists.
 */
export async function loadDbRegistrations({ seasonName, pendingOnly, take }: { seasonName?: string; pendingOnly?: boolean; take?: number } = {}) {
  const season = seasonName ? await prisma.season.findUnique({ where: { name: seasonName }, select: { id: true } }) : null;
  const regs = await prisma.registration.findMany({
    where: { ...(season ? { seasonId: season.id } : {}), ...(pendingOnly ? { status: "PENDING" as const } : {}) },
    include: { player: { include: { user: { select: { email: true } } } } },
    orderBy: { submittedAt: "desc" },
    take,
  });
  const teams = await teamLookup(regs.flatMap((r) => parseList(r.selectedTeams).slice(0, 1)));
  return regs.map<RegListRow>((r) => {
    const picks = parseList(r.selectedTeams);
    const first = picks[0];
    const t = first ? teams.get(first) : undefined;
    return {
      id: r.id,
      name: `${r.player.firstName} ${r.player.lastName}`.trim(),
      email: r.player.user.email,
      status: r.status,
      payment: r.paymentStatus,
      submitted: shortDate(r.submittedAt),
      submittedAt: r.submittedAt.getTime(),
      amount: Number(r.totalAmount.toString()),
      division: t?.division.name ?? "—",
      preferred: t?.name ?? first ?? "—",
      captainRequest: parseList(r.captainRequests).length > 0,
      needsPlacement: picks.length === 0,
      isNew: r.registrationType === "NEW_PLAYER",
      open: r.status === "PENDING",
    };
  });
}
