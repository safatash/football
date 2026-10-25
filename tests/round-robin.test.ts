import { describe, expect, it } from "vitest";
import { generateSchedule, matchDays, roundRobinRounds, slotsOn, weekdayOf } from "@/lib/round-robin";

const pairKey = (a: string, b: string) => [a, b].sort().join("-");

describe("round-robin pairings", () => {
  it("every team meets every other team exactly once, one match per team per round", () => {
    for (const n of [2, 3, 4, 5, 6, 7, 8]) {
      const teams = Array.from({ length: n }, (_, i) => `t${i}`);
      const rounds = roundRobinRounds(teams);
      expect(rounds).toHaveLength(n % 2 ? n : n - 1);
      const seen = new Set<string>();
      for (const round of rounds) {
        const inRound = round.flatMap((p) => [p.home, p.away]);
        expect(new Set(inRound).size).toBe(inRound.length);
        for (const p of round) seen.add(pairKey(p.home, p.away));
      }
      expect(seen.size).toBe((n * (n - 1)) / 2);
    }
  });

  it("home and away are balanced within half a game per team", () => {
    for (let n = 3; n <= 12; n++) {
      const teams = Array.from({ length: n }, (_, i) => `t${i}`);
      const home = new Map(teams.map((t) => [t, 0]));
      for (const p of roundRobinRounds(teams).flat()) home.set(p.home, home.get(p.home)! + 1);
      const games = n - 1;
      for (const h of home.values()) expect(Math.abs(h - games / 2)).toBeLessThanOrEqual(0.5);
    }
  });

  it("a double round robin plays each pair twice, once at each team's home", () => {
    const pairs = roundRobinRounds(["a", "b", "c", "d"], true).flat();
    expect(pairs).toHaveLength(12);
    const homes = new Set(pairs.map((p) => `${p.home}>${p.away}`));
    expect(homes.size).toBe(12);
  });
});

describe("slots and match days", () => {
  it("kickoffs every slot length while the match still fits", () => {
    // Sunday 9:00–15:00, 120 minutes apart, 90-minute matches: 9:00, 11:00, 13:00
    expect(slotsOn("2026-09-06", [{ fieldId: "f1", weekday: 0, startMinute: 540, endMinute: 900 }], 120, 90).map((s) => s.startMinute)).toEqual([540, 660, 780]);
    expect(slotsOn("2026-09-07", [{ fieldId: "f1", weekday: 0, startMinute: 540, endMinute: 900 }], 120, 90)).toEqual([]);
  });

  it("match days are the chosen weekdays between two dates, minus skipped ones", () => {
    expect(weekdayOf("2026-09-06")).toBe(0);
    expect(matchDays("2026-09-01", "2026-09-30", new Set([0]), new Set(["2026-09-13"]))).toEqual(["2026-09-06", "2026-09-20", "2026-09-27"]);
  });
});

describe("generateSchedule", () => {
  const windows = [
    { fieldId: "f1", weekday: 0, startMinute: 540, endMinute: 900 },
    { fieldId: "f2", weekday: 0, startMinute: 540, endMinute: 780 },
  ];
  const sundays = matchDays("2026-09-01", "2026-12-31", new Set([0]));
  const base = { dates: sundays, windows, slotMinutes: 120, matchMinutes: 90 };

  it("schedules every pairing once, nobody twice a day, no slot twice", () => {
    const { matches, unscheduled } = generateSchedule({ ...base, divisions: [{ id: "d1", teamIds: ["a", "b", "c", "d", "e", "f"] }, { id: "d2", teamIds: ["g", "h", "i", "j"] }] });
    expect(unscheduled).toEqual([]);
    expect(matches).toHaveLength(15 + 6);
    expect(new Set(matches.map((m) => `${m.date}|${m.fieldId}|${m.startMinute}`)).size).toBe(matches.length);
    const teamDays = matches.flatMap((m) => [`${m.date}|${m.homeTeamId}`, `${m.date}|${m.awayTeamId}`]);
    expect(new Set(teamDays).size).toBe(teamDays.length);
    expect(new Set(matches.filter((m) => m.divisionId === "d1").map((m) => pairKey(m.homeTeamId, m.awayTeamId))).size).toBe(15);
  });

  it("never schedules a team on its blackout date", () => {
    const blackouts = new Map([["a", new Set(["2026-09-06", "2026-09-13"])]]);
    const { matches } = generateSchedule({ ...base, divisions: [{ id: "d1", teamIds: ["a", "b", "c", "d"] }], blackouts });
    expect(matches.filter((m) => [m.homeTeamId, m.awayTeamId].includes("a") && ["2026-09-06", "2026-09-13"].includes(m.date))).toEqual([]);
    expect(matches).toHaveLength(6);
  });

  it("works around existing matches and reports what doesn't fit", () => {
    const { matches, unscheduled } = generateSchedule({
      ...base,
      dates: ["2026-09-06"],
      divisions: [{ id: "d1", teamIds: ["a", "b", "c", "d"] }],
      taken: [{ date: "2026-09-06", fieldId: "f1", startMinute: 540 }],
      busy: [{ teamId: "a", date: "2026-09-06" }],
    });
    expect(matches.some((m) => m.fieldId === "f1" && m.startMinute === 540)).toBe(false);
    expect(matches.some((m) => m.homeTeamId === "a" || m.awayTeamId === "a")).toBe(false);
    expect(matches.length + unscheduled.length).toBe(6);
    expect(unscheduled.length).toBeGreaterThan(0);
  });
});
