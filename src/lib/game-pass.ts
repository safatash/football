import { TZ, dayKey } from "@/lib/format";

/** The UTC instant of a wall-clock time in Eastern time on a calendar day (YYYY-MM-DD). */
export function easternTime(day: string, time = "00:00") {
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  // Offset of Eastern time at that moment (handles daylight time)
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(guess));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asEastern = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return new Date(guess + (guess - asEastern));
}

/**
 * A game pass is valid on match day only: from 00:00 Eastern until 23:59 Eastern, or until the
 * match ends if that's later.
 */
export function passWindow(match: { scheduledAt: Date; endTime?: Date | null }) {
  const day = dayKey(match.scheduledAt);
  const validFrom = easternTime(day, "00:00");
  const endOfDay = easternTime(day, "23:59");
  const validUntil = match.endTime && match.endTime > endOfDay ? match.endTime : endOfDay;
  return { validFrom, validUntil };
}

export const passExpired = (pass: { validUntil: Date }, at: Date) => at.getTime() > pass.validUntil.getTime();

/** Effective status: an ACTIVE pass past its window reads as EXPIRED even before the cron runs. */
export const passStatus = (pass: { status: string; validUntil: Date }, at: Date) =>
  pass.status === "ACTIVE" && passExpired(pass, at) ? "EXPIRED" : pass.status;
