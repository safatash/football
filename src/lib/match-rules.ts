/** Server-side rules for match rosters and match reports (pure; actions load the data). */

export type RosterCandidate = {
  teamRosterId: string;
  name: string;
  position: string;
  suspended: boolean;
  gamePass: boolean;
  /** For game-pass players: the match the pass covers and whether it's still valid. */
  passMatchId?: string | null;
  passValid?: boolean;
  availability?: "AVAILABLE" | "UNAVAILABLE" | "MAYBE" | null;
};

export const isGoalkeeper = (position: string) => /^(gk|goalkeeper|keeper)$/i.test(position.trim());

export function validateMatchRoster(selected: RosterCandidate[], opts: { matchId: string; max: number }) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const ids = new Set<string>();
  for (const p of selected) {
    if (ids.has(p.teamRosterId)) errors.push(`${p.name} is listed twice.`);
    ids.add(p.teamRosterId);
  }
  if (selected.length > opts.max) errors.push(`A match roster can have at most ${opts.max} players. Remove ${selected.length - opts.max}.`);
  for (const p of selected) {
    if (p.suspended) errors.push(`${p.name} is suspended and can’t play.`);
    if (p.gamePass && (p.passMatchId !== opts.matchId || !p.passValid)) errors.push(`${p.name}’s game pass doesn’t cover this match.`);
    if (p.availability === "UNAVAILABLE") warnings.push(`${p.name} said they can’t make it.`);
  }
  if (selected.length && !selected.some((p) => isGoalkeeper(p.position))) errors.push("Pick at least one goalkeeper.");
  if (!selected.length) errors.push("Pick at least one player.");
  return { errors, warnings };
}

/** Lineup slots must be filled by players on the finalized match roster, one slot each. */
export function validateLineup(slots: Record<string, string | null | undefined>, rosterIds: Set<string>, allowedSlots: string[]) {
  const errors: string[] = [];
  const used = new Set<string>();
  for (const [slot, id] of Object.entries(slots)) {
    if (!allowedSlots.includes(slot)) errors.push(`${slot} isn’t a position in this formation.`);
    if (!id) continue;
    if (!rosterIds.has(id)) errors.push(`The player in ${slot} isn’t on the finalized match roster.`);
    if (used.has(id)) errors.push(`A player can only fill one position (${slot}).`);
    used.add(id);
  }
  return errors;
}

export type ReportStat = { name: string; goals: number; assists: number; yellow: number; red: number };

export function validateReport(input: { teamScore: number; opponentScore: number; stats: ReportStat[]; redCardNote?: string | null }) {
  const errors: string[] = [];
  const whole = (n: number) => Number.isInteger(n) && n >= 0;
  if (!whole(input.teamScore) || !whole(input.opponentScore)) errors.push("Scores must be whole numbers, 0 or more.");
  for (const s of input.stats) {
    if (![s.goals, s.assists, s.yellow, s.red].every(whole)) errors.push(`${s.name}: stats must be whole numbers, 0 or more.`);
    if (s.yellow > 2) errors.push(`${s.name} can’t have more than 2 yellow cards.`);
    if (s.red > 1) errors.push(`${s.name} can’t have more than 1 red card.`);
  }
  const goals = input.stats.reduce((n, s) => n + s.goals, 0);
  if (whole(input.teamScore) && goals !== input.teamScore) {
    errors.push(`Player goals add up to ${goals}, but your team scored ${input.teamScore}.`);
  }
  const assists = input.stats.reduce((n, s) => n + s.assists, 0);
  if (assists > goals) errors.push("There are more assists than goals.");
  const reds = input.stats.some((s) => s.red > 0 || s.yellow >= 2);
  if (reds && !input.redCardNote?.trim()) errors.push("Describe what happened with the red card.");
  return errors;
}
