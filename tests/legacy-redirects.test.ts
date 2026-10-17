import { describe, expect, it } from "vitest";
import { resolveLegacy, type LegacyDb } from "@/lib/legacy-redirects";

const seasons = {
  spring2026: { id: "s26", slug: "spring-2026", isActive: true },
  fall2025: { id: "f25", slug: "fall-2025", isActive: false },
};
const db: LegacyDb = {
  season: async (ds) => (ds ? (seasons as Record<string, (typeof seasons)["spring2026"]>)[ds] ?? null : seasons.spring2026),
  team: async (seasonId, id) => ({ s26: { 12: { id: "team-ffx" } }, f25: { 7: { id: "team-ffx-fall" } } } as Record<string, Record<number, { id: string }>>)[seasonId]?.[id] ?? null,
  division: async (seasonId, id) => (seasonId === "s26" && id === 3 ? { code: "wp" } : null),
  match: async (seasonId, id) => (seasonId === "f25" && id === 501 ? { id: "match-501" } : null),
  player: async (key) => (key === "legacy:4410" ? { id: "player-maya" } : null),
};
const go = (kind: Parameters<typeof resolveLegacy>[0], qs: string) => resolveLegacy(kind, new URLSearchParams(qs), db);

describe("legacy redirects", () => {
  it("finds teams in the active season when season is missing or 0", async () => {
    expect(await go("team", "id=12")).toBe("/teams/team-ffx");
    expect(await go("team", "id=12&season=0")).toBe("/teams/team-ffx");
    expect(await go("team", "id=12&season=spring2026")).toBe("/teams/team-ffx");
  });

  it("keeps an archived season in the new URL", async () => {
    expect(await go("team", "id=7&season=fall2025")).toBe("/teams/team-ffx-fall?season=fall-2025");
    expect(await go("results", "id=0&season=fall2025")).toBe("/results?season=fall-2025");
    expect(await go("divisions", "season=FALL2025")).toBe("/standings?season=fall-2025");
  });

  it("sends a team from another season's id space to the list page", async () => {
    // id 7 exists in fall 2025, not in the active season
    expect(await go("team", "id=7")).toBe("/teams?notice=team-not-found");
    expect(await go("team", "id=12&season=fall2025")).toBe("/teams?notice=team-not-found&season=fall-2025");
  });

  it("handles unknown seasons and bad ids", async () => {
    expect(await go("team", "id=12&season=spring1999")).toBe("/teams?notice=team-not-found");
    expect(await go("results", "season=spring1999")).toBe("/results?notice=season-not-found");
    expect(await go("team", "id=abc")).toBe("/teams?notice=team-not-found");
    expect(await go("team", "")).toBe("/teams?notice=team-not-found");
  });

  it("maps divisions, game reports, calendars and players", async () => {
    expect(await go("division", "id=3")).toBe("/divisions/wp");
    expect(await go("division", "id=99")).toBe("/standings?notice=division-not-found");
    expect(await go("gamereport", "home=1&away=2&gid=501&id=3&season=fall2025")).toBe("/matches/match-501");
    expect(await go("gamereport", "gid=501")).toBe("/results?notice=game-not-found");
    expect(await go("export", "id=12")).toBe("/teams/team-ffx/calendar.ics");
    expect(await go("export", "id=999")).toBe("/teams?notice=team-not-found");
    expect(await go("player", "id=4410&season=fall2025")).toBe("/players/player-maya");
    expect(await go("player", "id=1")).toBe("/teams?notice=player-not-found");
  });
});
