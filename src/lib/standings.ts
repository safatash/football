/** League table rules: 3 points per win, 1 per draw; ties broken by goal difference, then goals for. */
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
  pts: number;
};

export function computeStandings<T extends StandingTeam>(teams: T[], results: Result[]): StandingRow<T>[] {
  const rows = new Map(teams.map((team) => [team.id, { team, played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 }]));
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
    .map((r) => ({ ...r, gd: r.gf - r.ga, pts: r.w * 3 + r.d }))
    .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.team.name.localeCompare(b.team.name));
}
