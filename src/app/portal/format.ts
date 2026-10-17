/** Date helpers for portal pages. League times are Eastern. */
const TZ = "America/New_York";

export const fmtDay = (d: Date) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: TZ });
export const fmtShort = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: TZ });
export const fmtTime = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: TZ });

const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });

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

export const captainLine = (names: string[], teamName: string) =>
  names.length === 0
    ? `${teamName} doesn’t have a captain yet`
    : names.length === 1
      ? `${names[0]} captains ${teamName}`
      : `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]} captain ${teamName}`;
