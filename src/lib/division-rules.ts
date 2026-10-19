/** Division limits that show as warnings rather than errors. */

type RosterLimits = { rosterMin: number | null; rosterMax: number | null };

/** "Below the roster minimum (12)" etc., or null when the roster size is fine. */
export function rosterWarning(size: number, d: RosterLimits) {
  if (d.rosterMin != null && size < d.rosterMin)
    return `${size} players, below the division’s minimum of ${d.rosterMin}`;
  if (d.rosterMax != null && size > d.rosterMax)
    return `${size} players, above the division’s maximum of ${d.rosterMax}`;
  return null;
}

/** "12–20 players", "At least 12", "Up to 20" or "No limits". */
export function rosterLimitLabel(d: RosterLimits) {
  if (d.rosterMin != null && d.rosterMax != null)
    return `${d.rosterMin}–${d.rosterMax} players`;
  if (d.rosterMin != null) return `At least ${d.rosterMin} players`;
  if (d.rosterMax != null) return `Up to ${d.rosterMax} players`;
  return "No limits";
}
