import { describe, expect, it } from "vitest";
import { isOfficeRole } from "@/lib/access";
import { accountPasswordErrors } from "@/lib/password";

describe("admin access", () => {
  it("treats OWNER and ADMIN members as league office", () => {
    expect(isOfficeRole("OWNER")).toBe(true);
    expect(isOfficeRole("ADMIN")).toBe(true);
    expect(isOfficeRole("STAFF")).toBe(false);
    expect(isOfficeRole("PLAYER")).toBe(false);
    expect(isOfficeRole(null)).toBe(false);
  });
});

describe("account password rules", () => {
  it("requires 10+ characters with upper, lower and a number", () => {
    expect(accountPasswordErrors("Short1A")).toContain("Password must be at least 10 characters long");
    expect(accountPasswordErrors("alllowercase1")).toHaveLength(1);
    expect(accountPasswordErrors("GoodPassword26")).toEqual([]);
  });
});
