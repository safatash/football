import { describe, expect, it } from "vitest";
import { easternTime, passStatus, passWindow } from "@/lib/game-pass";

describe("game pass validity window", () => {
  it("runs from midnight to 23:59 Eastern on match day (daylight time)", () => {
    const { validFrom, validUntil } = passWindow({ scheduledAt: new Date("2026-05-17T13:00:00Z") });
    expect(validFrom.toISOString()).toBe("2026-05-17T04:00:00.000Z");
    expect(validUntil.toISOString()).toBe("2026-05-18T03:59:00.000Z");
  });
  it("uses standard time in winter", () => {
    const { validFrom } = passWindow({ scheduledAt: new Date("2026-11-08T15:00:00Z") });
    expect(validFrom.toISOString()).toBe("2026-11-08T05:00:00.000Z");
  });
  it("uses the Eastern match day even when UTC has rolled over", () => {
    // 9:30 PM Eastern on May 17 is May 18 in UTC
    const { validFrom } = passWindow({ scheduledAt: new Date("2026-05-18T01:30:00Z") });
    expect(validFrom.toISOString()).toBe("2026-05-17T04:00:00.000Z");
  });
  it("extends to the match end when a late game runs past midnight", () => {
    const end = new Date("2026-05-18T04:30:00Z");
    expect(passWindow({ scheduledAt: new Date("2026-05-18T02:30:00Z"), endTime: end }).validUntil).toEqual(end);
  });
  it("reads as expired after the window even before the cron marks it", () => {
    const pass = { status: "ACTIVE", validUntil: easternTime("2026-05-17", "23:59") };
    expect(passStatus(pass, new Date("2026-05-17T20:00:00Z"))).toBe("ACTIVE");
    expect(passStatus(pass, new Date("2026-05-18T04:00:00Z"))).toBe("EXPIRED");
    expect(passStatus({ ...pass, status: "CANCELLED" }, new Date("2026-05-18T04:00:00Z"))).toBe("CANCELLED");
  });
});
