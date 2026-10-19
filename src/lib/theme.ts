/**
 * League colors as theme variables. The primary color replaces the "pitch" green and the accent
 * replaces "lime"; shades and text colors are derived so contrast holds in light and dark mode.
 * Without colors the app keeps its own green (globals.css).
 */
const HEX = /^#[0-9a-f]{6}$/i;
export const isHexColor = (c: string | null | undefined): c is string => !!c && HEX.test(c);

type Rgb = [number, number, number];
const toRgb = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
const toHex = (c: Rgb) => `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;
/** Mix `hex` toward `toward` by `t` (0–1). */
const mix = (hex: string, toward: string, t: number) => {
  const a = toRgb(hex);
  const b = toRgb(toward);
  return toHex([0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t) as Rgb);
};
/** WCAG relative luminance. */
export function luminance(hex: string) {
  const [r, g, b] = toRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}
/** Black-ish or white, whichever reads better on `bg`. */
export const inkOn = (bg: string) => (contrast(bg, "#ffffff") >= contrast(bg, "#13201a") ? "#ffffff" : "#13201a");

/** CSS overriding the theme variables for a league, or "" to keep the defaults. */
export function themeCss(primary: string | null | undefined, accent: string | null | undefined) {
  const light: string[] = [];
  const dark: string[] = [];
  if (isHexColor(primary)) {
    // Keep the pitch dark enough for white text on it (headers, buttons)
    let p = primary.toLowerCase();
    for (let i = 0; i < 10 && contrast(p, "#ffffff") < 4.5; i++) p = mix(p, "#000000", 0.12);
    light.push(`--pitch:${p}`, `--pitch-2:${mix(p, "#ffffff", 0.14)}`, `--pitch-tint:${mix(p, "#ffffff", 0.87)}`, `--on-pitch:#ffffff`);
    dark.push(`--pitch:${mix(p, "#ffffff", 0.18)}`, `--pitch-2:${mix(p, "#ffffff", 0.3)}`, `--pitch-tint:${mix(p, "#000000", 0.72)}`);
  }
  if (isHexColor(accent)) {
    const a = accent.toLowerCase();
    light.push(`--lime:${a}`, `--lime-2:${mix(a, "#000000", 0.1)}`, `--lime-ink:${inkOn(a)}`);
  }
  if (!light.length) return "";
  const darkRule = dark.length ? `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${dark.join(";")}}}` : "";
  return `:root{${light.join(";")}}${darkRule}`;
}

/** Browser chrome color for light mode. */
export const themeColor = (primary: string | null | undefined) => (isHexColor(primary) ? primary : "#0f3d2e");
