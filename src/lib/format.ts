/** Formatting helpers. League times are Eastern, whatever the server's time zone. */
export const TZ = "America/New_York";

export const fmtDay = (d: Date) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: TZ });
export const fmtShort = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: TZ });
export const fmtLong = (d: Date) => d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: TZ });
export const fmtTime = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: TZ });
/** Calendar date (YYYY-MM-DD) for a timestamp, in Eastern time. */
export const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });
/** Calendar date (YYYY-MM-DD) for a date-only column (stored at UTC midnight). */
export const isoDate = (d: Date) => d.toISOString().slice(0, 10);
/** "Mar 29" for a date-only column. */
export const fmtShortDateOnly = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
/** "Dec 31, 2008" for a date-only column. */
export const fmtDateOnly = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** "Today", "Tomorrow" or the short date. */
export function relativeDay(d: Date, now = new Date()) {
  if (dayKey(d) === dayKey(now)) return "Today";
  if (dayKey(d) === dayKey(new Date(now.getTime() + 864e5))) return "Tomorrow";
  return fmtDay(d);
}

export const money = (v: number | { toString(): string }) => {
  const n = Number(v);
  return `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
};

export const initials = (n: string) =>
  n
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export const fullName = (p: { firstName: string; lastName: string }) => `${p.firstName} ${p.lastName}`.trim();

export const regNumber = (n: number) => `R-${n}`;

export const captainLine = (names: string[], teamName: string) =>
  names.length === 0
    ? `${teamName} doesn’t have a captain yet`
    : names.length === 1
      ? `${names[0]} captains ${teamName}`
      : `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]} captain ${teamName}`;
