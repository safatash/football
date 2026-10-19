import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { now } from "@/lib/clock";
import { fmtDay, fmtTime, dayKey } from "@/lib/format";
import { addressLine, fieldName } from "@/lib/public";
import { doubleBooked } from "@/lib/schedule-rules";

/** Matches still to be played (not finished or called off). */
export const upcomingWhere = (): Prisma.MatchWhereInput => ({ scheduledAt: { gte: now() }, status: { in: ["SCHEDULED", "POSTPONED"] } });

export const SURFACE: Record<string, string> = { GRASS: "Grass", TURF: "Turf" };
export const SIZE: Record<string, string> = { FULL: "Full size", SMALL_SIDED: "Small-sided" };

/** Every park with its fields and how many upcoming matches each field has. */
export async function listParks() {
  const [parks, counts] = await Promise.all([
    db.park.findMany({ include: { fields: { orderBy: { name: "asc" } } }, orderBy: { name: "asc" } }),
    db.match.groupBy({ by: ["fieldId"], where: { ...upcomingWhere(), fieldId: { not: null } }, _count: { _all: true } }),
  ]);
  const upcoming = new Map(counts.map((c) => [c.fieldId, c._count._all]));
  return parks.map((p) => ({
    ...p,
    addressLine: addressLine({ address: p.address, city: p.city, state: p.state, zip: p.zip }),
    fields: p.fields.map((f) => ({ ...f, label: fieldName(f.name), upcoming: upcoming.get(f.id) ?? 0 })),
  }));
}

export async function getPark(id: string) {
  return db.park.findUnique({ where: { id }, include: { fields: { orderBy: { name: "asc" }, include: { _count: { select: { matches: true } } } } } });
}

/** A field with its park, upcoming matches (grouped by day, double bookings flagged) and match count. */
export async function getFieldSchedule(id: string) {
  const field = await db.field.findUnique({ where: { id }, include: { park: true, _count: { select: { matches: true } } } });
  if (!field) return null;
  const matches = await db.match.findMany({
    where: { fieldId: id, ...upcomingWhere() },
    select: {
      id: true,
      gameNumber: true,
      scheduledAt: true,
      status: true,
      season: { select: { name: true, isActive: true } },
      division: { select: { name: true } },
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
    orderBy: { scheduledAt: "asc" },
  });
  const clash = doubleBooked(matches);
  const days = new Map<string, { label: string; matches: (typeof matches[number] & { time: string; clash: boolean })[] }>();
  for (const m of matches) {
    const k = dayKey(m.scheduledAt);
    if (!days.has(k)) days.set(k, { label: fmtDay(m.scheduledAt), matches: [] });
    days.get(k)!.matches.push({ ...m, time: fmtTime(m.scheduledAt), clash: clash.has(m.id) });
  }
  return { field, label: fieldName(field.name), days: [...days.values()], upcoming: matches.length, clashes: clash.size };
}
