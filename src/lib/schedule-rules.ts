/** Scheduling checks for admin-created matches (pure; the actions load the data). */

/** A game takes this long on the field; overlapping slots for a team or field are flagged. */
export const MATCH_MINUTES = 90;

export type Slot = {
  id?: string;
  gameNumber?: number;
  homeTeamId: string;
  awayTeamId: string;
  scheduledAt: Date;
  fieldId?: string | null;
  status?: string;
};

const overlaps = (a: Date, b: Date) => Math.abs(a.getTime() - b.getTime()) < MATCH_MINUTES * 60_000;

/** Hard errors: a team can't play itself, and both teams must be in the match's division. */
export function matchTeamErrors(m: { homeTeamId: string; awayTeamId: string; divisionId: string }, teams: { id: string; divisionId: string; name: string }[]) {
  const errors: string[] = [];
  if (m.homeTeamId === m.awayTeamId) errors.push("Home and away can’t be the same team.");
  for (const [id, side] of [
    [m.homeTeamId, "home"],
    [m.awayTeamId, "away"],
  ] as const) {
    const t = teams.find((x) => x.id === id);
    if (!t) errors.push(`Pick a ${side} team.`);
    else if (t.divisionId !== m.divisionId) errors.push(`${t.name} isn’t in this division.`);
  }
  return errors;
}

/**
 * Warnings (the office can still save): either team already plays within a game's length of this
 * kickoff, or the field is already booked then. Cancelled games and the match itself are ignored.
 */
export function scheduleConflicts(candidate: Slot, others: Slot[], names: Record<string, string>, fieldName?: string | null) {
  const warnings: string[] = [];
  const live = others.filter((o) => o.id !== candidate.id && o.status !== "CANCELLED" && overlaps(o.scheduledAt, candidate.scheduledAt));
  for (const teamId of [candidate.homeTeamId, candidate.awayTeamId]) {
    const clash = live.find((o) => o.homeTeamId === teamId || o.awayTeamId === teamId);
    if (clash) warnings.push(`${names[teamId] ?? "A team"} already plays then${clash.gameNumber ? ` (Game #${clash.gameNumber})` : ""}.`);
  }
  if (candidate.fieldId) {
    const booked = live.find((o) => o.fieldId === candidate.fieldId);
    if (booked) warnings.push(`${fieldName ?? "That field"} is already booked then${booked.gameNumber ? ` (Game #${booked.gameNumber})` : ""}.`);
  }
  return warnings;
}
