import { describe, expect, it } from "vitest";
import { contrast, inkOn, isHexColor, themeCss } from "@/lib/theme";

describe("league theme colors", () => {
  it("keeps the app's colors when a league has none", () => {
    expect(themeCss(null, null)).toBe("");
  });

  it("only accepts #RRGGBB, so nothing else reaches the stylesheet", () => {
    expect(isHexColor("#1C5598")).toBe(true);
    for (const bad of ["red", "#fff", "#1C5598;}body{display:none", "</style><script>", "url(x)"]) {
      expect(isHexColor(bad)).toBe(false);
      expect(themeCss(bad, bad)).toBe("");
    }
  });

  it("sets the pitch and lime variables, with a dark-mode pitch", () => {
    const css = themeCss("#1C5598", "#F5B700");
    expect(css).toContain("--pitch:#1c5598");
    expect(css).toContain("--lime:#f5b700");
    expect(css).toContain("--lime-ink:#13201a"); // dark text on a yellow accent
    expect(css).toContain("prefers-color-scheme: dark");
  });

  it("darkens a light main color until white text on it is readable", () => {
    const css = themeCss("#F5E663", null);
    const pitch = css.match(/--pitch:(#[0-9a-f]{6})/)![1];
    expect(contrast(pitch, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(inkOn("#0F3D2E")).toBe("#ffffff");
  });
});
