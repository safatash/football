import { describe, expect, it } from "vitest";
import { validateLineup, validateMatchRoster, validateReport, type RosterCandidate } from "@/lib/match-rules";

const p = (id: string, over: Partial<RosterCandidate> = {}): RosterCandidate => ({
  teamRosterId: id,
  name: `Player ${id}`,
  position: "MID",
  suspended: false,
  gamePass: false,
  availability: "AVAILABLE",
  ...over,
});
const keeper = p("gk", { position: "GK", name: "Priya Raman" });
const opts = { matchId: "m204", max: 18 };

describe("match roster rules", () => {
  it("accepts a legal roster", () => {
    expect(validateMatchRoster([keeper, p("1"), p("2")], opts)).toEqual({ errors: [], warnings: [] });
  });
  it("limits the roster size", () => {
    const many = [keeper, ...Array.from({ length: 18 }, (_, i) => p(String(i)))];
    expect(validateMatchRoster(many, opts).errors).toContain("A match roster can have at most 18 players. Remove 1.");
  });
  it("blocks suspended players", () => {
    expect(validateMatchRoster([keeper, p("cv", { name: "Carmen Vega", suspended: true })], opts).errors).toEqual(["Carmen Vega is suspended and can’t play."]);
  });
  it("allows game-pass players only for the match their pass covers", () => {
    const jordan = p("jl", { name: "Jordan Lee", gamePass: true, passMatchId: "m204", passValid: true });
    expect(validateMatchRoster([keeper, jordan], opts).errors).toEqual([]);
    expect(validateMatchRoster([keeper, jordan], { ...opts, matchId: "m209" }).errors).toEqual(["Jordan Lee’s game pass doesn’t cover this match."]);
    expect(validateMatchRoster([keeper, { ...jordan, passValid: false }], opts).errors).toHaveLength(1);
  });
  it("needs at least one goalkeeper", () => {
    expect(validateMatchRoster([p("1"), p("2")], opts).errors).toEqual(["Pick at least one goalkeeper."]);
    expect(validateMatchRoster([p("g", { position: "Goalkeeper" })], opts).errors).toEqual([]);
  });
  it("warns about, but allows, unavailable players", () => {
    const res = validateMatchRoster([keeper, p("lt", { name: "Lily Tran", availability: "UNAVAILABLE" })], opts);
    expect(res.errors).toEqual([]);
    expect(res.warnings).toEqual(["Lily Tran said they can’t make it."]);
  });
});

describe("lineup rules", () => {
  const slots = ["GK", "LB", "ST"];
  it("only places finalized-roster players, once each", () => {
    const roster = new Set(["a", "b"]);
    expect(validateLineup({ GK: "a", LB: "b", ST: null }, roster, slots)).toEqual([]);
    expect(validateLineup({ GK: "a", LB: "z" }, roster, slots)).toEqual(["The player in LB isn’t on the finalized match roster."]);
    expect(validateLineup({ GK: "a", LB: "a" }, roster, slots)).toEqual(["A player can only fill one position (LB)."]);
    expect(validateLineup({ XX: "a" }, roster, slots)).toEqual(["XX isn’t a position in this formation."]);
  });
});

describe("match report validation", () => {
  const stat = (name: string, goals = 0, extra: Partial<{ assists: number; yellow: number; red: number }> = {}) => ({ name, goals, assists: 0, yellow: 0, red: 0, ...extra });
  it("accepts goals that add up to the score", () => {
    expect(validateReport({ teamScore: 2, opponentScore: 0, stats: [stat("Maya", 1), stat("Nadia", 1, { assists: 1 })] })).toEqual([]);
  });
  it("requires player goals to equal the team score", () => {
    expect(validateReport({ teamScore: 3, opponentScore: 1, stats: [stat("Maya", 2)] })).toEqual(["Player goals add up to 2, but your team scored 3."]);
  });
  it("requires a note when there's a red card (or two yellows)", () => {
    expect(validateReport({ teamScore: 0, opponentScore: 2, stats: [stat("Carmen", 0, { red: 1 })] })).toEqual(["Describe what happened with the red card."]);
    expect(validateReport({ teamScore: 0, opponentScore: 2, stats: [stat("Carmen", 0, { yellow: 2 })] })).toEqual(["Describe what happened with the red card."]);
    expect(validateReport({ teamScore: 0, opponentScore: 2, stats: [stat("Carmen", 0, { red: 1 })], redCardNote: "Serious foul play, 71'" })).toEqual([]);
  });
  it("rejects impossible numbers", () => {
    expect(validateReport({ teamScore: -1, opponentScore: 0, stats: [] })).toContain("Scores must be whole numbers, 0 or more.");
    expect(validateReport({ teamScore: 1, opponentScore: 0, stats: [stat("A", 1, { assists: 2 })] })).toContain("There are more assists than goals.");
  });
});
