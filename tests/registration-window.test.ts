import { describe, expect, it } from "vitest";
import { registrationWindow } from "@/lib/registration-window";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const season = (opens: string | null, closes: string | null, isActive = true) => ({
  name: "Fall 2026",
  isActive,
  registrationOpensOn: opens ? d(opens) : null,
  registrationClosesOn: closes ? d(closes) : null,
});
// 11:30pm Eastern on Aug 31 is already Sep 1 in UTC: the window follows the league's day
const lateAug31 = new Date("2026-09-01T03:30:00Z");

describe("registration window", () => {
  it("needs an active season and the league's switch on", () => {
    expect(registrationWindow({ leagueOpen: true, season: null, at: lateAug31 })).toMatchObject({ open: false, reason: "no-season" });
    expect(registrationWindow({ leagueOpen: true, season: season(null, null, false), at: lateAug31 })).toMatchObject({ open: false, reason: "no-season" });
    expect(registrationWindow({ leagueOpen: false, season: season(null, null), at: lateAug31 })).toMatchObject({ open: false, reason: "league-closed" });
    expect(registrationWindow({ leagueOpen: true, season: season(null, null), at: lateAug31 })).toEqual({ open: true });
  });

  it("opens and closes on inclusive league days", () => {
    expect(registrationWindow({ leagueOpen: true, season: season("2026-09-01", null), at: lateAug31 })).toMatchObject({ open: false, reason: "not-yet", message: expect.stringContaining("Sep 1, 2026") });
    expect(registrationWindow({ leagueOpen: true, season: season("2026-08-31", "2026-08-31"), at: lateAug31 })).toEqual({ open: true });
    expect(registrationWindow({ leagueOpen: true, season: season(null, "2026-08-30"), at: lateAug31 })).toMatchObject({ open: false, reason: "closed" });
  });
});
