import { describe, expect, it } from "vitest";
import { isValidSlug, parseHost } from "@/lib/tenant";

describe("platform hosts", () => {
  it("serves the operator area on the root domain and admin.<root>", () => {
    expect(parseHost("example.com", "example.com")).toEqual({ kind: "root" });
    expect(parseHost("www.example.com", "example.com")).toEqual({ kind: "root" });
    expect(parseHost("admin.example.com", "example.com")).toEqual({ kind: "root" });
    expect(parseHost("nvasa.example.com", "example.com")).toEqual({ kind: "subdomain", slug: "nvasa" });
  });

  it("never lets a league take a reserved address", () => {
    for (const s of ["admin", "www", "api", "platform", "signup"]) expect(isValidSlug(s)).toBe(false);
    expect(isValidSlug("springfield-soccer")).toBe(true);
    expect(isValidSlug("ab")).toBe(false);
    expect(isValidSlug("-bad")).toBe(false);
  });
});
