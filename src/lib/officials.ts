/** Match officials: roles, crews, pay and assignment checks (pure; callers load the data). */
import { MATCH_MINUTES } from "@/lib/schedule-rules";

export type Role = "CENTER" | "AR1" | "AR2" | "FOURTH";
export type OfficialStatus = "ASSIGNED" | "CONFIRMED" | "DECLINED" | "NO_SHOW";

export const ROLES: Role[] = ["CENTER", "AR1", "AR2", "FOURTH"];
/** A full crew is a center referee and two assistants; the 4th official is optional. */
export const CREW: Role[] = ["CENTER", "AR1", "AR2"];
export const ROLE_LABEL: Record<Role, string> = { CENTER: "Center", AR1: "AR1", AR2: "AR2", FOURTH: "4th official" };
export const STATUS_LABEL: Record<OfficialStatus, string> = { ASSIGNED: "Assigned", CONFIRMED: "Confirmed", DECLINED: "Declined", NO_SHOW: "No-show" };

/** Declined assignments leave the slot open. */
export const fills = (o: { status: OfficialStatus | string }) => o.status !== "DECLINED";

type Official = { role: Role | string; status: OfficialStatus | string; referee: { name: string } };

/** Center, AR1, AR2 names (blank when open), for the match sheet and older views. */
export function crewNames(officials: Official[]): [string, string, string] {
  const name = (r: Role) => officials.find((o) => o.role === r && fills(o))?.referee.name ?? "";
  return [name("CENTER"), name("AR1"), name("AR2")];
}

/** Crew roles still open (declined counts as open). */
export const openRoles = (officials: Pick<Official, "role" | "status">[]) => CREW.filter((r) => !officials.some((o) => o.role === r && fills(o)));

type DivisionFees = { centerRefFee: unknown; assistantRefFee: unknown; fourthRefFee: unknown } | null | undefined;
const num = (v: unknown) => (v == null ? null : Number(v));

/** What a role pays in a division (null when the division has no fee set). */
export function defaultFee(division: DivisionFees, role: Role | string) {
  if (!division) return null;
  if (role === "CENTER") return num(division.centerRefFee);
  if (role === "FOURTH") return num(division.fourthRefFee);
  return num(division.assistantRefFee);
}

/** The fee owed for one assignment: the match's override, else the division default, else 0. */
export const feeFor = (o: { fee: unknown; role: Role | string }, division: DivisionFees) => num(o.fee) ?? defaultFee(division, o.role) ?? 0;

/** Counts toward pay: the referee turned up (or is expected to). */
export const worked = (o: { status: OfficialStatus | string }) => o.status === "ASSIGNED" || o.status === "CONFIRMED";

export type Booking = { matchId: string; gameNumber: number; scheduledAt: Date; parkId: string | null; parkName: string | null; dayKey: string };

/**
 * Warnings for putting a referee on a match: they're already on another match that overlaps the
 * kickoff (within a game's length), or on a match at a different park the same day.
 */
export function refereeConflicts(name: string, match: Booking, others: Booking[]) {
  const warnings: string[] = [];
  const rest = others.filter((o) => o.matchId !== match.matchId);
  const overlap = rest.find((o) => Math.abs(o.scheduledAt.getTime() - match.scheduledAt.getTime()) < MATCH_MINUTES * 60_000);
  if (overlap) warnings.push(`${name} is already on Game #${overlap.gameNumber} at an overlapping time.`);
  const elsewhere = rest.find((o) => o !== overlap && o.dayKey === match.dayKey && o.parkId && match.parkId && o.parkId !== match.parkId);
  if (elsewhere) warnings.push(`${name} is at ${elsewhere.parkName ?? "another park"} that day (Game #${elsewhere.gameNumber}).`);
  return warnings;
}

/** "expired", "expiring" (within 30 days) or null for a certification expiry date. */
export function certState(expires: Date | null | undefined, at: Date) {
  if (!expires) return null;
  const days = (expires.getTime() - at.getTime()) / 864e5;
  if (days < 0) return "expired" as const;
  if (days <= 30) return "expiring" as const;
  return null;
}
