/** Scheduling checks for admin-created matches (pure; the actions load the data). */

/** A game takes this long; a team booked twice within it is flagged. */
export const MATCH_MINUTES = 90;
/** A field needs this long between kickoffs (game, warm-up and changeover). */
export const FIELD_GAP_MINUTES = 120;

export type Slot = {
  id?: string;
  gameNumber?: number;
  homeTeamId: string;
  awayTeamId: string;
  scheduledAt: Date;
  fieldId?: string | null;
  status?: string;
};

const within = (a: Date, b: Date, minutes: number) => Math.abs(a.getTime() - b.getTime()) < minutes * 60_000;

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
 * kickoff, or the field has another kickoff within 2 hours. Cancelled games and the match itself
 * are ignored.
 */
export function scheduleConflicts(candidate: Slot, others: Slot[], names: Record<string, string>, fieldName?: string | null) {
  const warnings: string[] = [];
  const live = others.filter((o) => o.id !== candidate.id && o.status !== "CANCELLED");
  for (const teamId of [candidate.homeTeamId, candidate.awayTeamId]) {
    const clash = live.find((o) => (o.homeTeamId === teamId || o.awayTeamId === teamId) && within(o.scheduledAt, candidate.scheduledAt, MATCH_MINUTES));
    if (clash) warnings.push(`${names[teamId] ?? "A team"} already plays then${clash.gameNumber ? ` (Game #${clash.gameNumber})` : ""}.`);
  }
  if (candidate.fieldId) {
    const booked = live.find((o) => o.fieldId === candidate.fieldId && within(o.scheduledAt, candidate.scheduledAt, FIELD_GAP_MINUTES));
    if (booked) warnings.push(`${fieldName ?? "That field"} is already booked within 2 hours${booked.gameNumber ? ` (Game #${booked.gameNumber})` : ""}.`);
  }
  return warnings;
}

/** Ids of a field's matches that start within 2 hours of another (cancelled games don't count). */
export function doubleBooked(slots: { id: string; scheduledAt: Date; status?: string }[]) {
  const live = slots.filter((s) => s.status !== "CANCELLED").sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  const hit = new Set<string>();
  for (let i = 1; i < live.length; i++) {
    if (within(live[i - 1].scheduledAt, live[i].scheduledAt, FIELD_GAP_MINUTES)) {
      hit.add(live[i - 1].id);
      hit.add(live[i].id);
    }
  }
  return hit;
}
