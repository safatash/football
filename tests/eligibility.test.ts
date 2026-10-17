import { describe, expect, it } from "vitest";
import { ageOn, checkEligibility, type DivisionRule, type GenderValue } from "@/lib/eligibility";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const OPENING_DAY = "2026-03-29";
const EIGHTEEN = d("2008-03-29");

// Spring 2026 divisions as seeded
const DIVISIONS: Record<string, DivisionRule> = {
  wp: { genderRule: "WOMEN", maleBornOnOrBefore: null, femaleBornOnOrBefore: EIGHTEEN, minAge: 18 },
  md1: { genderRule: "MEN", maleBornOnOrBefore: EIGHTEEN, femaleBornOnOrBefore: null, minAge: 18 },
  d3: { genderRule: "COED", maleBornOnOrBefore: d("2008-12-31"), femaleBornOnOrBefore: d("2008-12-31"), minAge: 18 },
  mc: { genderRule: "COED", maleBornOnOrBefore: d("1991-12-31"), femaleBornOnOrBefore: d("1996-12-31"), minAge: 18 },
  cc: { genderRule: "COED", maleBornOnOrBefore: EIGHTEEN, femaleBornOnOrBefore: EIGHTEEN, minAge: 18 },
};
const check = (div: string, dob: string, gender: GenderValue) => checkEligibility(DIVISIONS[div], { dob, gender }, OPENING_DAY);
const eligible = (dob: string, gender: GenderValue) =>
  Object.keys(DIVISIONS)
    .filter((k) => check(k, dob, gender).ok)
    .sort();

describe("ageOn", () => {
  it("counts whole years, turning a year older on the birthday", () => {
    expect(ageOn("2008-03-29", OPENING_DAY)).toBe(18);
    expect(ageOn("2008-03-30", OPENING_DAY)).toBe(17);
    expect(ageOn("1994-03-12", OPENING_DAY)).toBe(32);
    expect(ageOn("2000-02-29", "2026-02-28")).toBe(25);
    expect(ageOn("not a date", OPENING_DAY)).toBeNull();
  });
});

describe("division eligibility", () => {
  it("women's division: women 18+ only", () => {
    expect(check("wp", "1995-06-01", "FEMALE")).toEqual({ ok: true });
    expect(check("wp", "1995-06-01", "MALE")).toEqual({ ok: false, reason: "Women only" });
    expect(check("wp", "1995-06-01", "NON_BINARY")).toEqual({ ok: false, reason: "Women only" });
  });

  it("men's division: men 18+ only", () => {
    expect(check("md1", "1995-06-01", "MALE")).toEqual({ ok: true });
    expect(check("md1", "1995-06-01", "FEMALE")).toEqual({ ok: false, reason: "Men only" });
    expect(check("md1", "1995-06-01", "NON_BINARY")).toEqual({ ok: false, reason: "Men only" });
  });

  it("age 18 on opening day is eligible; one day short is not", () => {
    for (const div of ["wp", "cc"]) expect(check(div, "2008-03-29", "FEMALE").ok).toBe(true);
    expect(check("md1", "2008-03-29", "MALE").ok).toBe(true);
    expect(check("wp", "2008-03-30", "FEMALE")).toEqual({ ok: false, reason: "Must be 18+" });
    expect(check("md1", "2008-03-30", "MALE")).toEqual({ ok: false, reason: "Must be 18+" });
    expect(check("d3", "2008-03-30", "MALE")).toEqual({ ok: false, reason: "Must be 18+" });
  });

  it("masters coed uses separate cutoffs for men and women", () => {
    expect(check("mc", "1991-12-31", "MALE").ok).toBe(true);
    expect(check("mc", "1992-01-01", "MALE")).toEqual({ ok: false, reason: "Born after cutoff" });
    expect(check("mc", "1996-12-31", "FEMALE").ok).toBe(true);
    expect(check("mc", "1997-01-01", "FEMALE")).toEqual({ ok: false, reason: "Born after cutoff" });
  });

  it("non-binary players: coed divisions only, using the stricter (male) cutoff", () => {
    expect(eligible("1990-05-05", "NON_BINARY")).toEqual(["cc", "d3", "mc"]);
    // Born 1994: inside the women's masters cutoff but not the men's
    expect(check("mc", "1994-05-05", "NON_BINARY")).toEqual({ ok: false, reason: "Born after cutoff" });
    expect(check("mc", "1994-05-05", "FEMALE").ok).toBe(true);
  });

  it("lists every division a player can join", () => {
    expect(eligible("1985-01-01", "FEMALE")).toEqual(["cc", "d3", "mc", "wp"]);
    expect(eligible("1985-01-01", "MALE")).toEqual(["cc", "d3", "mc", "md1"]);
    expect(eligible("2001-01-01", "MALE")).toEqual(["cc", "d3", "md1"]);
    expect(eligible("2010-01-01", "FEMALE")).toEqual([]);
  });
});
