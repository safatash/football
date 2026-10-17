import { describe, expect, it } from "vitest";
import { computeStandings } from "@/lib/standings";

const teams = [
  { id: "a", name: "Alexandria FC" },
  { id: "b", name: "Burke Athletic" },
  { id: "c", name: "Fairfax United" },
  { id: "d", name: "Potomac Valkyries" },
];
const r = (homeTeamId: string, awayTeamId: string, homeScore: number, awayScore: number) => ({ homeTeamId, awayTeamId, homeScore, awayScore });

describe("standings", () => {
  it("awards 3 points per win and 1 per draw", () => {
    const rows = computeStandings(teams, [r("a", "b", 2, 0), r("c", "d", 1, 1)]);
    const by = Object.fromEntries(rows.map((x) => [x.team.id, x]));
    expect(by.a).toMatchObject({ played: 1, w: 1, d: 0, l: 0, gf: 2, ga: 0, gd: 2, pts: 3 });
    expect(by.b).toMatchObject({ played: 1, w: 0, l: 1, pts: 0, gd: -2 });
    expect(by.c).toMatchObject({ d: 1, pts: 1 });
    expect(by.d).toMatchObject({ d: 1, pts: 1 });
  });

  it("breaks ties on goal difference, then goals for", () => {
    const rows = computeStandings(teams, [
      r("a", "b", 1, 0), // a: 3 pts, +1
      r("c", "d", 3, 0), // c: 3 pts, +3
      r("d", "b", 4, 2), // d: 3 pts, -1 overall; b: 0 pts
    ]);
    expect(rows.map((x) => x.team.id)).toEqual(["c", "a", "d", "b"]);

    const tied = computeStandings(teams, [r("a", "b", 3, 1), r("c", "d", 2, 0)]); // both +2, a scored more
    expect(tied.slice(0, 2).map((x) => x.team.id)).toEqual(["a", "c"]);
  });

  it("includes teams with no games and ignores results for unknown teams", () => {
    const rows = computeStandings(teams, [r("a", "zzz", 5, 0)]);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({ team: { id: "a" }, pts: 3 });
    expect(rows.find((x) => x.team.id === "d")).toMatchObject({ played: 0, pts: 0 });
  });
});
