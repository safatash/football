/**
 * Round-robin schedule generation (pure; the actions load the data and save the result).
 *
 * 1. Pairings: the circle method gives every team one match per round (odd counts get a bye),
 *    alternating home and away; a double round robin repeats it with home and away swapped.
 * 2. Slots: each match day offers the kickoff times of the fields' weekly availability windows
 *    (every `slotMinutes`, as long as the match fits before the window closes), minus slots
 *    already used by existing matches.
 * 3. Filling: match days in order; pairings in round order (earliest rounds first, divisions
 *    interleaved), each into the earliest free slot. A team plays at most once a day, never on a
 *    blackout date, and never twice in the same slot. A pairing that can't go on a day waits for
 *    the next one; whatever is left at the end comes back as unscheduled.
 */

export type Pairing = { home: string; away: string; round: number };

/** Every pairing for one division, round by round. */
export function roundRobinRounds(teamIds: string[], double = false): Pairing[][] {
  const teams: (string | null)[] = [...teamIds];
  if (teams.length < 2) return [];
  if (teams.length % 2) teams.push(null); // bye
  const n = teams.length;
  const rounds: Pairing[][] = [];
  let order = teams;
  for (let r = 0; r < n - 1; r++) {
    const round: Pairing[] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = order[i];
      const b = order[n - 1 - i];
      if (!a || !b) continue;
      // The fixed team alternates home and away; rotation balances everyone else (within half a game)
      const flip = i === 0 && r % 2 === 1;
      round.push(flip ? { home: b, away: a, round: r + 1 } : { home: a, away: b, round: r + 1 });
    }
    rounds.push(round);
    // Keep the first team fixed and rotate the rest one place
    order = [order[0], order[n - 1], ...order.slice(1, n - 1)];
  }
  if (!double) return rounds;
  return [...rounds, ...rounds.map((round, i) => round.map((p) => ({ home: p.away, away: p.home, round: rounds.length + i + 1 })))];
}

export type Window = { fieldId: string; weekday: number; startMinute: number; endMinute: number };
export type Slot = { date: string; fieldId: string; startMinute: number };
export type ProposedMatch = Slot & { divisionId: string; homeTeamId: string; awayTeamId: string; round: number };
export type Unscheduled = { divisionId: string; homeTeamId: string; awayTeamId: string; round: number };

export type GenerateInput = {
  divisions: { id: string; teamIds: string[] }[];
  /** Candidate match days, ISO dates (league calendar). */
  dates: string[];
  windows: Window[];
  double?: boolean;
  /** Minutes between kickoffs on one field (match, warm-up and changeover). */
  slotMinutes: number;
  /** How long a match takes: the last kickoff must leave this much before the window closes. */
  matchMinutes: number;
  /** Team id → ISO dates it can't play. */
  blackouts?: Map<string, Set<string>>;
  /** Slots already used by existing matches. */
  taken?: Slot[];
  /** Teams already playing on a date (existing matches). */
  busy?: { teamId: string; date: string }[];
};

/** Weekday (0 = Sunday) of an ISO date. */
export const weekdayOf = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();

/** Kickoff slots on one day, earliest first (then by field). */
export function slotsOn(date: string, windows: Window[], slotMinutes: number, matchMinutes: number): Slot[] {
  const day = weekdayOf(date);
  const out: Slot[] = [];
  for (const w of windows.filter((x) => x.weekday === day)) {
    for (let t = w.startMinute; t + matchMinutes <= w.endMinute; t += slotMinutes) out.push({ date, fieldId: w.fieldId, startMinute: t });
  }
  return out.sort((a, b) => a.startMinute - b.startMinute || a.fieldId.localeCompare(b.fieldId));
}

/** ISO dates from `start` to `end` (inclusive) on the given weekdays, minus `skip`. */
export function matchDays(start: string, end: string, weekdays: Set<number>, skip: Set<string> = new Set()) {
  const out: string[] = [];
  for (let d = new Date(`${start}T12:00:00Z`); d <= new Date(`${end}T12:00:00Z`); d = new Date(d.getTime() + 864e5)) {
    const iso = d.toISOString().slice(0, 10);
    if (weekdays.has(d.getUTCDay()) && !skip.has(iso)) out.push(iso);
  }
  return out;
}

export function generateSchedule(input: GenerateInput): { matches: ProposedMatch[]; unscheduled: Unscheduled[] } {
  const pending: (Pairing & { divisionId: string })[] = input.divisions
    .flatMap((d) => roundRobinRounds(d.teamIds, input.double).flat().map((p) => ({ ...p, divisionId: d.id })))
    // Earliest rounds first; divisions interleave within a round
    .sort((a, b) => a.round - b.round);
  const taken = new Set((input.taken ?? []).map((s) => `${s.date}|${s.fieldId}|${s.startMinute}`));
  const busy = new Set((input.busy ?? []).map((b) => `${b.date}|${b.teamId}`));
  const blackedOut = (team: string, date: string) => input.blackouts?.get(team)?.has(date) ?? false;
  const matches: ProposedMatch[] = [];

  for (const date of [...input.dates].sort()) {
    if (!pending.length) break;
    const free = slotsOn(date, input.windows, input.slotMinutes, input.matchMinutes).filter((s) => !taken.has(`${s.date}|${s.fieldId}|${s.startMinute}`));
    for (let i = 0; i < pending.length && free.length; ) {
      const p = pending[i];
      const ok = ![p.home, p.away].some((t) => busy.has(`${date}|${t}`) || blackedOut(t, date));
      if (!ok) {
        i++;
        continue;
      }
      const slot = free.shift()!;
      matches.push({ ...slot, divisionId: p.divisionId, homeTeamId: p.home, awayTeamId: p.away, round: p.round });
      busy.add(`${date}|${p.home}`);
      busy.add(`${date}|${p.away}`);
      pending.splice(i, 1);
    }
  }
  return { matches, unscheduled: pending.map((p) => ({ divisionId: p.divisionId, homeTeamId: p.home, awayTeamId: p.away, round: p.round })) };
}
