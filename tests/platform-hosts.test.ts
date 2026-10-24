import { afterEach, describe, expect, it, vi } from "vitest";
import { isValidSlug, parseHost } from "@/lib/tenant";

describe("platform hosts", () => {
  it("serves the operator area on the root domain and admin.<root>", () => {
    expect(parseHost("example.com", "example.com")).toEqual({ kind: "root" });
    expect(parseHost("www.example.com", "example.com")).toEqual({ kind: "root" });
    expect(parseHost("admin.example.com", "example.com")).toEqual({ kind: "root" });
    expect(parseHost("nvasa.example.com", "example.com")).toEqual({ kind: "subdomain", slug: "nvasa" });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("treats *.vercel.app previews like local work only when ALLOW_ORG_FALLBACK=true", () => {
    expect(parseHost("leaguekeep-abc123.vercel.app", "example.com")).toEqual({ kind: "custom", domain: "leaguekeep-abc123.vercel.app" });
    vi.stubEnv("ALLOW_ORG_FALLBACK", "true");
    expect(parseHost("leaguekeep-abc123.vercel.app", "example.com")).toEqual({ kind: "local" });
    expect(parseHost("nvasa.example.com", "example.com")).toEqual({ kind: "subdomain", slug: "nvasa" });
  });

  it("never lets a league take a reserved address", () => {
    for (const s of ["admin", "www", "api", "platform", "signup"]) expect(isValidSlug(s)).toBe(false);
    expect(isValidSlug("springfield-soccer")).toBe(true);
    expect(isValidSlug("ab")).toBe(false);
    expect(isValidSlug("-bad")).toBe(false);
  });
});
