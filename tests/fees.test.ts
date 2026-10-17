import { describe, expect, it } from "vitest";
import { discountLabel, priceRegistration, validateDiscount, type DiscountRule } from "@/lib/fees";

const base: DiscountRule = { code: "SPRING10", kind: "PROMO", type: "AMOUNT", value: 10, maxUses: 200, uses: 61, active: true, seasonId: "s26", teamId: null };
const ctx = { code: "spring10", seasonId: "s26", seasonName: "Spring 2026", teamId: null };

describe("fee calculation", () => {
  it("charges the division fee with no code", () => {
    expect(priceRegistration(95, null)).toEqual({ fee: 95, discount: 0, total: 95 });
  });
  it("takes dollar amounts off, never below zero", () => {
    expect(priceRegistration(105, base)).toEqual({ fee: 105, discount: 10, total: 95 });
    expect(priceRegistration(8, base)).toEqual({ fee: 8, discount: 8, total: 0 });
  });
  it("takes percentages off, rounded to cents", () => {
    expect(priceRegistration(55, { type: "PERCENT", value: 15 })).toEqual({ fee: 55, discount: 8.25, total: 46.75 });
    expect(priceRegistration(45, { type: "PERCENT", value: 100 })).toEqual({ fee: 45, discount: 45, total: 0 });
    expect(priceRegistration(60, { type: "PERCENT", value: 33.333 })).toEqual({ fee: 60, discount: 20, total: 40 });
  });
  it("labels codes", () => {
    expect(discountLabel({ type: "PERCENT", value: 100 })).toBe("100% off");
    expect(discountLabel({ type: "AMOUNT", value: 10 })).toBe("$10 off");
  });
});

describe("discount validation", () => {
  it("accepts an active code for the season, case-insensitively", () => {
    expect(validateDiscount(base, ctx)).toEqual({ ok: true });
  });
  it("rejects unknown, inactive, other-season and used-up codes", () => {
    expect(validateDiscount(null, ctx)).toEqual({ ok: false, message: "“SPRING10” isn’t a valid code for Spring 2026." });
    expect(validateDiscount({ ...base, active: false }, ctx).ok).toBe(false);
    expect(validateDiscount({ ...base, seasonId: "f25" }, ctx).ok).toBe(false);
    expect(validateDiscount({ ...base, uses: 200 }, ctx)).toEqual({ ok: false, message: "“SPRING10” has been used up." });
    expect(validateDiscount({ ...base, maxUses: null, uses: 9999 }, ctx)).toEqual({ ok: true });
  });
  it("TEAM_PAID codes only work for their team", () => {
    const team = { ...base, code: "TEAMPAID-FFX", kind: "TEAM_PAID" as const, type: "PERCENT" as const, value: 100, teamId: "ffx" };
    expect(validateDiscount(team, { ...ctx, code: "TEAMPAID-FFX", teamId: "ffx" })).toEqual({ ok: true });
    expect(validateDiscount(team, { ...ctx, code: "TEAMPAID-FFX", teamId: "alx" }).ok).toBe(false);
    expect(validateDiscount(team, { ...ctx, code: "TEAMPAID-FFX", teamId: null }).ok).toBe(false);
  });
  it("asks for a code when blank", () => {
    expect(validateDiscount(base, { ...ctx, code: "  " })).toEqual({ ok: false, message: "Enter a code first." });
  });
});
