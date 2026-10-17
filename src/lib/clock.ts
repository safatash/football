/**
 * The league's "now". Set NVASA_NOW (an ISO date-time) to view the app as of another moment,
 * e.g. NVASA_NOW=2026-05-16T12:00:00-04:00 to see the seeded Spring 2026 match week.
 * Leave it unset in production.
 */
export function now(): Date {
  const override = process.env.NVASA_NOW;
  if (override) {
    const d = new Date(override);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}
