import { afterEach, describe, expect, it, vi } from "vitest";
import { isAdminEmail, isAdminUser } from "@/lib/admin";
import { accountPasswordErrors } from "@/lib/password";

describe("admin access", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("defaults ADMIN_EMAILS to the league office account", () => {
    vi.stubEnv("ADMIN_EMAILS", undefined as unknown as string);
    delete process.env.ADMIN_EMAILS;
    expect(isAdminEmail("SafaTash@gmail.com")).toBe(true);
    expect(isAdminEmail("someone@example.com")).toBe(false);
  });

  it("accepts the ADMIN role or a listed email", () => {
    vi.stubEnv("ADMIN_EMAILS", "office@nvasa.org, chair@nvasa.org");
    expect(isAdminUser({ email: "player@example.com", role: "ADMIN" })).toBe(true);
    expect(isAdminUser({ email: "chair@nvasa.org", role: "PLAYER" })).toBe(true);
    expect(isAdminUser({ email: "player@example.com", role: "PLAYER" })).toBe(false);
    expect(isAdminUser(null)).toBe(false);
  });
});

describe("account password rules", () => {
  it("requires 10+ characters with upper, lower and a number", () => {
    expect(accountPasswordErrors("Short1A")).toContain("Password must be at least 10 characters long");
    expect(accountPasswordErrors("alllowercase1")).toHaveLength(1);
    expect(accountPasswordErrors("GoodPassword26")).toEqual([]);
  });
});
