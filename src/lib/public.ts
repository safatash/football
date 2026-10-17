/** Helpers for the public league pages (pure, safe to use on the client). */

/** "#007" for display; game numbers keep their digits past 999. */
export const gameNo = (n: number) => `#${String(n).padStart(3, "0")}`;

export type Place = { complex?: string | null; name?: string | null; address?: string | null; city?: string | null; state?: string | null; zip?: string | null };

/** "Wakefield Park · Field 3 · Annandale" */
export function placeLabel(p: Place | null, fallback?: string | null) {
  if (!p?.complex) return fallback ?? "";
  return [p.complex, p.name ? (/^\d+$/.test(p.name) ? `Field ${p.name}` : p.name) : null, p.city].filter(Boolean).join(" · ");
}

/** Google Maps directions for a field (address when we have it, else the park and town). */
export function directionsUrl(p: Place | null, fallback?: string | null) {
  const query = p?.complex
    ? [p.address ? null : p.complex, p.address, p.city, p.state, p.zip].filter(Boolean).join(", ")
    : (fallback ?? "");
  if (!query.trim()) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export type Outcome = "W" | "D" | "L";
/** Result from one side's point of view. */
export const outcomeFor = (us: number, them: number): Outcome => (us > them ? "W" : us < them ? "L" : "D");

/** Screen-reader sentence for a final score, e.g. "Fairfax United won 2 to 0 against Burke Athletic". */
export function scoreLabel(home: string, away: string, h: number, a: number) {
  if (h === a) return `${home} and ${away} drew ${h} to ${a}`;
  return h > a ? `${home} won ${h} to ${a} against ${away}` : `${away} won ${a} to ${h} against ${home}`;
}

/** Season slug from a name: "Spring 2026" → "spring-2026". */
export const seasonSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
