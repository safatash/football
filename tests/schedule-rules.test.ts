import { describe, expect, it } from "vitest";
import { doubleBooked, matchTeamErrors, scheduleConflicts } from "@/lib/schedule-rules";

const teams = [
  { id: "ffx", divisionId: "wp", name: "Fairfax United" },
  { id: "alx", divisionId: "wp", name: "Alexandria FC" },
  { id: "nvs", divisionId: "md1", name: "Nova Strikers" },
];
const names = Object.fromEntries(teams.map((t) => [t.id, t.name]));
const at = (iso: string) => new Date(iso);

describe("match team rules", () => {
  it("accepts two teams from the division", () => {
    expect(matchTeamErrors({ homeTeamId: "ffx", awayTeamId: "alx", divisionId: "wp" }, teams)).toEqual([]);
  });
  it("rejects a team playing itself and teams from another division", () => {
    expect(matchTeamErrors({ homeTeamId: "ffx", awayTeamId: "ffx", divisionId: "wp" }, teams)).toEqual(["Home and away can’t be the same team."]);
    expect(matchTeamErrors({ homeTeamId: "ffx", awayTeamId: "nvs", divisionId: "wp" }, teams)).toEqual(["Nova Strikers isn’t in this division."]);
    expect(matchTeamErrors({ homeTeamId: "", awayTeamId: "alx", divisionId: "wp" }, teams)).toEqual(["Pick a home team."]);
  });
});

describe("schedule conflicts", () => {
  const existing = [
    { id: "m1", gameNumber: 204, homeTeamId: "ffx", awayTeamId: "alx", scheduledAt: at("2026-05-17T13:00:00Z"), fieldId: "wak3", status: "SCHEDULED" },
    { id: "m2", gameNumber: 210, homeTeamId: "nvs", awayTeamId: "x", scheduledAt: at("2026-05-17T15:00:00Z"), fieldId: "wak3", status: "CANCELLED" },
  ];
  it("warns when a team already plays then", () => {
    const w = scheduleConflicts({ homeTeamId: "ffx", awayTeamId: "pot", scheduledAt: at("2026-05-17T14:00:00Z"), fieldId: "lee2" }, existing, names);
    expect(w).toEqual(["Fairfax United already plays then (Game #204)."]);
  });
  it("warns when the field has another kickoff within 2 hours", () => {
    const w = scheduleConflicts({ homeTeamId: "pot", awayTeamId: "brk", scheduledAt: at("2026-05-17T13:30:00Z"), fieldId: "wak3" }, existing, names, "Wakefield Park 3");
    expect(w).toEqual(["Wakefield Park 3 is already booked within 2 hours (Game #204)."]);
    // 1 h 50 later: fine for the teams, too close for the field
    expect(scheduleConflicts({ homeTeamId: "ffx", awayTeamId: "alx", scheduledAt: at("2026-05-17T14:50:00Z"), fieldId: "wak3" }, existing, names, "Wakefield Park 3")).toEqual([
      "Wakefield Park 3 is already booked within 2 hours (Game #204).",
    ]);
  });
  it("ignores teams 90+ minutes apart, fields 2+ hours apart, cancelled games and the match itself", () => {
    expect(scheduleConflicts({ homeTeamId: "ffx", awayTeamId: "alx", scheduledAt: at("2026-05-17T14:30:00Z"), fieldId: "lee2" }, existing, names)).toEqual([]);
    expect(scheduleConflicts({ homeTeamId: "pot", awayTeamId: "brk", scheduledAt: at("2026-05-17T15:00:00Z"), fieldId: "wak3" }, existing, names)).toEqual([]);
    expect(scheduleConflicts({ homeTeamId: "nvs", awayTeamId: "y", scheduledAt: at("2026-05-17T15:00:00Z"), fieldId: "wak3" }, existing, names)).toEqual([]);
    expect(scheduleConflicts({ id: "m1", homeTeamId: "ffx", awayTeamId: "alx", scheduledAt: at("2026-05-17T13:00:00Z"), fieldId: "wak3" }, existing, names)).toEqual([]);
  });
});

describe("field double bookings", () => {
  it("flags kickoffs on a field less than 2 hours apart, ignoring cancelled games", () => {
    const hits = doubleBooked([
      { id: "a", scheduledAt: at("2026-05-17T13:00:00Z") },
      { id: "b", scheduledAt: at("2026-05-17T14:30:00Z") },
      { id: "c", scheduledAt: at("2026-05-17T17:00:00Z") },
      { id: "d", scheduledAt: at("2026-05-17T17:30:00Z"), status: "CANCELLED" },
    ]);
    expect([...hits].sort()).toEqual(["a", "b"]);
  });
});
