/**
 * Old ColdFusion URLs → new pages. Lookups go by the season's legacy datasource name plus the
 * legacy id (ids were only unique within a season). A missing or "0" season means the active one.
 * Nothing found → the closest list page with `?notice=`.
 */
export type LegacyKind = "results" | "team" | "player" | "divisions" | "division" | "gamereport" | "export";

export type LegacyDb = {
  /** The season for a legacy datasource name, or the active season when `datasource` is null. */
  season(datasource: string | null): Promise<{ id: string; slug: string; isActive: boolean } | null>;
  team(seasonId: string, legacyId: number): Promise<{ id: string } | null>;
  division(seasonId: string, legacyId: number): Promise<{ code: string } | null>;
  match(seasonId: string, legacyId: number): Promise<{ id: string } | null>;
  /** Players keep one id across seasons on the old site, so the key is season-independent. */
  player(legacyKey: string): Promise<{ id: string } | null>;
};

export const legacyPlayerKey = (id: number) => `legacy:${id}`;

const intParam = (v: string | null) => (v && /^\d+$/.test(v.trim()) ? Number(v.trim()) : null);

export async function resolveLegacy(kind: LegacyKind, params: URLSearchParams, db: LegacyDb): Promise<string> {
  const raw = params.get("season")?.trim().toLowerCase() || null;
  const wanted = raw && raw !== "0" ? raw : null;
  const season = (wanted ? await db.season(wanted) : null) ?? (await db.season(null));
  const unknownSeason = !!wanted && !(await db.season(wanted));
  // Keep a non-active season in the new URL
  const q = (base: string, extra: Record<string, string> = {}) => {
    const p = new URLSearchParams(extra);
    if (season && !season.isActive && !unknownSeason) p.set("season", season.slug);
    return `${base}${p.size ? `?${p}` : ""}`;
  };
  const id = intParam(params.get("id"));

  switch (kind) {
    case "results":
      return q("/results", unknownSeason ? { notice: "season-not-found" } : {});
    case "divisions":
      return q("/standings", unknownSeason ? { notice: "season-not-found" } : {});
    case "team":
    case "export": {
      const team = season && id != null && !unknownSeason ? await db.team(season.id, id) : null;
      if (!team) return q("/teams", { notice: "team-not-found" });
      return kind === "export" ? `/teams/${team.id}/calendar.ics` : q(`/teams/${team.id}`);
    }
    case "division": {
      const div = season && id != null && !unknownSeason ? await db.division(season.id, id) : null;
      return div ? q(`/divisions/${div.code}`) : q("/standings", { notice: "division-not-found" });
    }
    case "gamereport": {
      const gid = intParam(params.get("gid"));
      const match = season && gid != null && !unknownSeason ? await db.match(season.id, gid) : null;
      return match ? `/matches/${match.id}` : q("/results", { notice: "game-not-found" });
    }
    case "player": {
      const player = id != null ? await db.player(legacyPlayerKey(id)) : null;
      return player ? `/players/${player.id}` : q("/teams", { notice: "player-not-found" });
    }
  }
}
