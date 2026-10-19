import { describe, expect, it } from "vitest";
import { cards, genderRuleFor, inGame, kickoff, parseGameTime, score, toDay, toHex } from "@/lib/legacy-import";

describe("legacy import mapping", () => {
  it("converts kit colors to hex", () => {
    expect(toHex("rgb(15, 61, 46)")).toBe("#0F3D2E");
    expect(toHex("rgba(255,255,255,1)")).toBe("#FFFFFF");
    expect(toHex("#abc")).toBe("#AABBCC");
    expect(toHex("0f3d2e")).toBe("#0F3D2E");
    expect(toHex("green")).toBeNull();
    expect(toHex("")).toBeNull();
  });
  it("reads free-text kickoff times", () => {
    expect(parseGameTime("8:00 PM")).toBe("20:00");
    expect(parseGameTime("9am")).toBe("09:00");
    expect(parseGameTime("12:30 pm")).toBe("12:30");
    expect(parseGameTime("12:00 AM")).toBe("00:00");
    expect(parseGameTime("13:15")).toBe("13:15");
    expect(parseGameTime("TBD")).toBeNull();
  });
  it("places kickoffs in Eastern time (noon when the time is unknown)", () => {
    expect(kickoff("2024-05-12", "9:00 AM")?.toISOString()).toBe("2024-05-12T13:00:00.000Z");
    expect(kickoff("2024-11-10", "9:00 AM")?.toISOString()).toBe("2024-11-10T14:00:00.000Z");
    expect(kickoff("2024-05-12", "")?.toISOString()).toBe("2024-05-12T16:00:00.000Z");
    expect(kickoff(null, "9:00 AM")).toBeNull();
    expect(toDay(new Date("2024-05-12T00:00:00Z"))).toBe("2024-05-12");
  });
  it("reads scores, cards and in/out", () => {
    expect(score("3")).toBe(3);
    expect(score("")).toBeNull();
    expect(score(0)).toBe(0);
    expect(inGame("In")).toBe("IN");
    expect(inGame("out")).toBe("OUT");
    expect(inGame("0")).toBe("DNP");
    expect(cards({ yellow: "UB", yellow2: "", red: "SFP", note: "Late tackle" })).toEqual({ yellow: 1, secondYellow: 0, red: 1, note: "Late tackle · Cards: Y UB, R SFP" });
    expect(cards({ yellow: "", yellow2: "", red: "", note: "" })).toEqual({ yellow: 0, secondYellow: 0, red: 0, note: null });
  });
  it("infers division gender rules from names", () => {
    expect(genderRuleFor("Women Premier")).toBe("WOMEN");
    expect(genderRuleFor("Men's D1")).toBe("MEN");
    expect(genderRuleFor("Masters Coed")).toBe("COED");
    expect(genderRuleFor("Over 30", "Men")).toBe("MEN");
    expect(genderRuleFor("Combination")).toBe("COED");
  });
});
