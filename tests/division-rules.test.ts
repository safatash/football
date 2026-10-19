import { describe, expect, it } from "vitest";
import { rosterLimitLabel, rosterWarning } from "@/lib/division-rules";

describe("division roster limits", () => {
  const limits = { rosterMin: 12, rosterMax: 20 };
  it("warns below the minimum and above the maximum only", () => {
    expect(rosterWarning(11, limits)).toMatch(/below the division’s minimum of 12/);
    expect(rosterWarning(21, limits)).toMatch(/above the division’s maximum of 20/);
    expect(rosterWarning(12, limits)).toBeNull();
    expect(rosterWarning(20, limits)).toBeNull();
    expect(rosterWarning(0, { rosterMin: null, rosterMax: null })).toBeNull();
  });
  it("labels the range", () => {
    expect(rosterLimitLabel(limits)).toBe("12–20 players");
    expect(rosterLimitLabel({ rosterMin: 12, rosterMax: null })).toBe("At least 12 players");
    expect(rosterLimitLabel({ rosterMin: null, rosterMax: 20 })).toBe("Up to 20 players");
    expect(rosterLimitLabel({ rosterMin: null, rosterMax: null })).toBe("No limits");
  });
});
