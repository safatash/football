/**
 * League table rules: 3 points per win, 1 per draw, plus any point adjustments (deductions are
 * negative); ties broken by goal difference, then goals for. Forfeits are stored as completed
 * matches with the forfeit score, so they count like any result.
 */
export type StandingTeam = { id: string; name: string };
export type Result = { homeTeamId: string; awayTeamId: string; homeScore: number; awayScore: number };
export type StandingRow<T extends StandingTeam = StandingTeam> = {
  team: T;
  played: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  /** Points added or taken off by the league office (PointAdjustment) */
  adj: number;
  pts: number;
};

export type Adjustment = { teamId: string; points: number };

export function computeStandings<T extends StandingTeam>(teams: T[], results: Result[], adjustments: Adjustment[] = []): StandingRow<T>[] {
  const rows = new Map(teams.map((team) => [team.id, { team, played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, adj: 0, pts: 0 }]));
  for (const a of adjustments) {
    const row = rows.get(a.teamId);
    if (row) row.adj += a.points;
  }
  for (const r of results) {
    const home = rows.get(r.homeTeamId);
    const away = rows.get(r.awayTeamId);
    for (const [row, us, them] of [
      [home, r.homeScore, r.awayScore],
      [away, r.awayScore, r.homeScore],
    ] as const) {
      if (!row) continue;
      row.played++;
      row.gf += us;
      row.ga += them;
      if (us > them) row.w++;
      else if (us === them) row.d++;
      else row.l++;
    }
  }
  return [...rows.values()]
    .map((r) => ({ ...r, gd: r.gf - r.ga, pts: r.w * 3 + r.d + r.adj }))
    .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.team.name.localeCompare(b.team.name));
}
