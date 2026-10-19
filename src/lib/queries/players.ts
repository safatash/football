import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { now } from "@/lib/clock";
import { fmtDateOnly, fullName } from "@/lib/format";
import { paymentLabel } from "./registrations";
import { seasonalWhere } from "./teams";

export type PlayerStatusLabel = "Active" | "Pending Approval" | "Suspended" | "Inactive";
export type TeamRole = "Captain" | "Player";

/** Active = started, not ended and not lifted. */
export const activeSuspensionWhere = (at = now()) =>
  ({ startsAt: { lte: at }, liftedAt: null, OR: [{ endsAt: null }, { endsAt: { gt: at } }] }) satisfies Prisma.SuspensionWhereInput;

/** Players with a registration, a season roster spot or a game pass in the season. */
const inSeasonWhere = (seasonId: string) =>
  ({
    OR: [
      { registrations: { some: { seasonId } } },
      { teamMemberships: { some: { ...seasonalWhere, team: { seasonId } } } },
      { gamePasses: { some: { match: { seasonId } } } },
    ],
  }) satisfies Prisma.PlayerWhereInput;

const playerSelect = (seasonId: string) =>
  ({
    id: true,
    firstName: true,
    lastName: true,
    status: true,
    finalApproval: true,
    registrationDate: true,
    user: { select: { id: true, email: true } },
    suspensions: { where: activeSuspensionWhere(), select: { reason: true, endsAt: true }, orderBy: { startsAt: "desc" }, take: 1 },
    teamMemberships: {
      where: { ...seasonalWhere, team: { seasonId } },
      select: {
        isCaptain: true,
        jerseyNumber: true,
        joinedAt: true,
        team: { select: { id: true, code: true, name: true, color: true, shortName: true, division: { select: { id: true, name: true } } } },
      },
      orderBy: { joinedAt: "asc" },
    },
    registrations: {
      where: { seasonId, status: { not: "CANCELLED" } },
      select: { id: true, status: true, paymentStatus: true, registrationType: true, division: { select: { id: true, name: true } } },
      orderBy: { submittedAt: "desc" },
    },
    gamePasses: {
      where: { match: { seasonId } },
      select: { id: true, status: true, validUntil: true, payment: { select: { status: true } }, match: { select: { gameNumber: true } } },
      orderBy: { validFrom: "desc" },
    },
  }) satisfies Prisma.PlayerSelect;
type PlayerRowData = Prisma.PlayerGetPayload<{ select: ReturnType<typeof playerSelect> }>;

function toRow(p: PlayerRowData) {
  const suspension = p.suspensions[0] ?? null;
  const status: PlayerStatusLabel =
    p.status === "SUSPENDED" || suspension
      ? "Suspended"
      : p.finalApproval === "NEEDS_REVIEW" || p.finalApproval === "PENDING"
        ? "Pending Approval"
        : p.status === "INACTIVE"
          ? "Inactive"
          : "Active";
  // Primary registration: the approved one if any, else the newest
  const reg = p.registrations.find((r) => r.status === "APPROVED") ?? p.registrations[0] ?? null;
  const teams = p.teamMemberships.map((m) => ({
    id: m.team.id,
    code: m.team.code,
    name: m.team.name,
    color: m.team.color,
    shortName: m.team.shortName,
    division: m.team.division,
    role: (m.isCaptain ? "Captain" : "Player") as TeamRole,
    jersey: m.jerseyNumber,
  }));
  const passOnly = !reg && !teams.length && p.gamePasses.length > 0;
  const pass = p.gamePasses[0];
  const note = suspension?.reason ?? (passOnly && pass ? `Game pass for Game #${pass.match.gameNumber} only.` : undefined);
  return {
    id: p.id,
    name: fullName(p),
    email: p.user.email,
    userId: p.user.id,
    status,
    teams,
    division: reg?.division ?? teams[0]?.division ?? null,
    reg: reg ? reg.status : passOnly ? "Game pass only" : "—",
    pay: reg ? paymentLabel(reg.status, reg.paymentStatus) : passOnly && pass ? (pass.payment.status as string) : "—",
    registrationId: reg?.id ?? null,
    since: p.registrationDate.getFullYear(),
    note,
    passGame: passOnly && pass ? pass.match.gameNumber : null,
  };
}
export type PlayerRow = ReturnType<typeof toRow>;

/** Players in a season, by last name. */
/** Players in a season. A search (`q`) looks across every player, so new accounts can be found. */
export async function listPlayers(seasonId: string, q = "") {
  const needle = q.trim();
  const rows = await db.player.findMany({
    where: needle
      ? {
          OR: [
            { firstName: { contains: needle, mode: "insensitive" } },
            { lastName: { contains: needle, mode: "insensitive" } },
            { user: { email: { contains: needle, mode: "insensitive" } } },
            ...(needle.includes(" ")
              ? [{ AND: [{ firstName: { contains: needle.split(" ")[0], mode: "insensitive" as const } }, { lastName: { contains: needle.split(" ").slice(1).join(" "), mode: "insensitive" as const } }] }]
              : []),
          ],
        }
      : inSeasonWhere(seasonId),
    select: playerSelect(seasonId),
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  return rows.map(toRow);
}

/** Distinct players with a registration in the season. */
export async function registeredCount(seasonId: string) {
  return db.player.count({ where: { registrations: { some: { seasonId, status: { not: "CANCELLED" } } } } });
}

/** Suspended players in a season (status or an active suspension). */
export async function suspendedPlayers(seasonId: string) {
  const rows = await db.player.findMany({
    where: { AND: [inSeasonWhere(seasonId), { OR: [{ status: "SUSPENDED" }, { suspensions: { some: activeSuspensionWhere() } }] }] },
    select: playerSelect(seasonId),
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  return rows.map(toRow);
}

/** A player's profile with this season's registration, passes and teams. */
export async function getPlayer(id: string, seasonId: string) {
  const p = await db.player.findUnique({
    where: { id },
    select: { ...playerSelect(seasonId), dob: true, position: true, phone: true, city: true, state: true, zip: true },
  });
  if (!p) return null;
  const row = toRow(p);
  const at = now();
  const jersey = row.teams.find((t) => t.jersey != null)?.jersey;
  return {
    ...row,
    born: fmtDateOnly(p.dob),
    position: p.position ? `${p.position}${jersey != null ? ` · #${jersey}` : ""}` : "—",
    phone: p.phone || "—",
    address: [p.city, [p.state, p.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "—",
    passes: p.gamePasses.map((g) => ({
      id: g.id,
      gameNumber: g.match.gameNumber,
      active: g.status === "ACTIVE" && g.validUntil > at,
    })),
  };
}
