import { describe, expect, it } from "vitest";
import { certState, crewNames, feeFor, openRoles, refereeConflicts } from "@/lib/officials";

const at = (s: string) => new Date(s);
const o = (role: string, name: string, status = "ASSIGNED") => ({ role, status, referee: { name } });

describe("crews", () => {
  it("names the crew and lists open roles; declined slots are open", () => {
    const crew = [o("CENTER", "Daniel Kim"), o("AR1", "Ana Silva", "DECLINED"), o("FOURTH", "Hugo Bell")];
    expect(crewNames(crew)).toEqual(["Daniel Kim", "", ""]);
    expect(openRoles(crew)).toEqual(["AR1", "AR2"]);
    expect(openRoles([o("CENTER", "a"), o("AR1", "b"), o("AR2", "c")])).toEqual([]);
  });
});

describe("referee fees", () => {
  const div = { centerRefFee: 40, assistantRefFee: 25, fourthRefFee: null };
  it("uses the match override, else the division's fee for the role, else 0", () => {
    expect(feeFor({ fee: null, role: "CENTER" }, div)).toBe(40);
    expect(feeFor({ fee: null, role: "AR2" }, div)).toBe(25);
    expect(feeFor({ fee: 55, role: "AR1" }, div)).toBe(55);
    expect(feeFor({ fee: null, role: "FOURTH" }, div)).toBe(0);
    expect(feeFor({ fee: null, role: "CENTER" }, null)).toBe(0);
  });
});

describe("referee conflicts", () => {
  const here = { matchId: "m1", gameNumber: 210, scheduledAt: at("2026-05-17T13:00:00Z"), parkId: "wak", parkName: "Wakefield Park", dayKey: "2026-05-17" };
  it("warns about overlapping matches and other parks the same day", () => {
    expect(refereeConflicts("Daniel Kim", here, [{ ...here, matchId: "m2", gameNumber: 204, scheduledAt: at("2026-05-17T13:30:00Z") }])).toEqual(["Daniel Kim is already on Game #204 at an overlapping time."]);
    expect(refereeConflicts("Daniel Kim", here, [{ ...here, matchId: "m3", gameNumber: 207, scheduledAt: at("2026-05-17T17:00:00Z"), parkId: "lee", parkName: "Lee District" }])).toEqual([
      "Daniel Kim is at Lee District that day (Game #207).",
    ]);
  });
  it("is fine at the same park later the same day, or another day", () => {
    expect(refereeConflicts("Daniel Kim", here, [{ ...here, matchId: "m4", gameNumber: 208, scheduledAt: at("2026-05-17T15:00:00Z") }])).toEqual([]);
    expect(refereeConflicts("Daniel Kim", here, [{ ...here, matchId: "m5", gameNumber: 300, scheduledAt: at("2026-05-24T13:00:00Z"), parkId: "lee", dayKey: "2026-05-24" }])).toEqual([]);
  });
});

describe("certification", () => {
  const now = at("2026-05-16T12:00:00Z");
  it("flags expired and expiring within 30 days", () => {
    expect(certState(at("2026-05-01T00:00:00Z"), now)).toBe("expired");
    expect(certState(at("2026-06-10T00:00:00Z"), now)).toBe("expiring");
    expect(certState(at("2026-09-01T00:00:00Z"), now)).toBeNull();
    expect(certState(null, now)).toBeNull();
  });
});
