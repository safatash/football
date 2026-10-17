import { cache } from "react";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

/* ---------- Divisions ---------- */

const divisionSelect = {
  id: true,
  code: true,
  name: true,
  description: true,
  level: true,
  registrationFee: true,
  genderRule: true,
  maleBornOnOrBefore: true,
  femaleBornOnOrBefore: true,
  minAge: true,
  displayOrder: true,
} satisfies Prisma.DivisionSelect;
export type DivisionRow = Prisma.DivisionGetPayload<{ select: typeof divisionSelect }>;

export const listDivisions = cache(async (seasonId: string): Promise<DivisionRow[]> =>
  prisma.division.findMany({ where: { seasonId }, select: divisionSelect, orderBy: [{ displayOrder: "asc" }, { name: "asc" }] }),
);

export async function getDivisionByCode(seasonId: string, code: string) {
  return prisma.division.findUnique({ where: { seasonId_code: { seasonId, code } }, select: divisionSelect });
}

/* ---------- Division age / gender labels ---------- */

const ymd = (d: Date) => d.toISOString().slice(0, 10);
/** "12/31/2008" for a date-only column. */
const slashDate = (d: Date) => d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric", timeZone: "UTC" });
/** "Dec 31, 2008" for a date-only column. */
const longDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** The cutoffs that apply to a division's gender rule. */
function cutoffs(d: Pick<DivisionRow, "genderRule" | "maleBornOnOrBefore" | "femaleBornOnOrBefore">) {
  const men = d.genderRule === "WOMEN" ? null : d.maleBornOnOrBefore;
  const women = d.genderRule === "MEN" ? null : d.femaleBornOnOrBefore;
  return { men, women };
}

/** True when a cutoff is just "minAge on opening day" (no stricter birth-date rule). */
function isMinAgeCutoff(cutoff: Date, minAge: number, openingDay: Date) {
  const o = ymd(openingDay);
  return ymd(cutoff) === `${String(Number(o.slice(0, 4)) - minAge).padStart(4, "0")}${o.slice(4)}`;
}

/** Whether men and women have different birth-date cutoffs in a coed division. */
export function hasSeparateCutoffs(d: Pick<DivisionRow, "genderRule" | "maleBornOnOrBefore" | "femaleBornOnOrBefore">) {
  const { men, women } = cutoffs(d);
  return d.genderRule === "COED" && !!men && !!women && ymd(men) !== ymd(women);
}

/** Short age rule, e.g. "18+", "Born on or before 12/31/2008", "Men born ≤ 12/31/1991 · Women ≤ 12/31/1996". */
export function ageLabel(d: DivisionRow, openingDay: Date) {
  const { men, women } = cutoffs(d);
  const strict = [men, women].filter((c): c is Date => !!c && !isMinAgeCutoff(c, d.minAge, openingDay));
  if (!strict.length) return `${d.minAge}+`;
  if (hasSeparateCutoffs(d)) return `Men born ≤ ${slashDate(men!)} · Women ≤ ${slashDate(women!)}`;
  return `Born on or before ${slashDate(strict[0])}`;
}

/** Full sentence for the division's eligibility rule. */
export function ruleText(d: DivisionRow, openingDay: Date) {
  if (d.description) return d.description;
  const { men, women } = cutoffs(d);
  const who = d.genderRule === "WOMEN" ? "Women, " : d.genderRule === "MEN" ? "Men, " : "";
  const strict = [men, women].filter((c): c is Date => !!c && !isMinAgeCutoff(c, d.minAge, openingDay));
  if (!strict.length) return `${who}${d.minAge} or older on opening day (${longDate(openingDay)})`;
  if (hasSeparateCutoffs(d)) return `Men born on or before ${longDate(men!)}; women on or before ${longDate(women!)}`;
  return `${who}Born on or before ${longDate(strict[0])}`;
}

export function genderLabel(d: Pick<DivisionRow, "genderRule" | "maleBornOnOrBefore" | "femaleBornOnOrBefore">) {
  if (d.genderRule === "WOMEN") return "Women";
  if (d.genderRule === "MEN") return "Men";
  return hasSeparateCutoffs(d) ? "Coed · separate cutoffs" : "Coed";
}

/* ---------- Match detail ---------- */

/** Both teams' reports for a match. */
export async function matchReports(matchId: string) {
  return prisma.matchReport.findMany({
    where: { matchId },
    select: { id: true, teamId: true, status: true, homeScore: true, awayScore: true, submittedAt: true, confirmedAt: true },
  });
}
export type MatchReportRow = Awaited<ReturnType<typeof matchReports>>[number];

/** Each team's match roster (selected players) with availability for that match. */
export async function matchRosters(matchId: string) {
  const [rosters, unavailable] = await Promise.all([
    prisma.matchRoster.findMany({
      where: { matchId },
      select: {
        teamId: true,
        status: true,
        entries: {
          select: {
            teamRoster: {
              select: {
                id: true,
                jerseyNumber: true,
                membershipType: true,
                player: { select: { firstName: true, lastName: true, status: true } },
              },
            },
          },
        },
      },
    }),
    prisma.matchAvailability.findMany({ where: { matchId, status: "UNAVAILABLE" }, select: { teamRosterId: true } }),
  ]);
  return { rosters, unavailable: new Set(unavailable.map((u) => u.teamRosterId)) };
}

/** Game-pass players registered for this match, by team. */
export async function matchGamePassPlayers(matchId: string) {
  return prisma.teamRoster.findMany({
    where: { matchId, membershipType: "GAME_PASS" },
    select: {
      id: true,
      teamId: true,
      jerseyNumber: true,
      player: { select: { firstName: true, lastName: true, status: true } },
    },
  });
}

/* ---------- Settings ---------- */

const KIND_LABEL = { BOARD: "Board member", PROMO: "Promo", TEAM_PAID: "Team paid in full" } as const;

export async function listDiscountCodes(seasonId: string) {
  const rows = await prisma.discountCode.findMany({
    where: { seasonId },
    select: { id: true, code: true, kind: true, type: true, value: true, uses: true, maxUses: true, active: true },
    orderBy: [{ active: "desc" }, { code: "asc" }],
  });
  return rows.map((c) => {
    const v = Number(c.value);
    const amount = Number.isInteger(v) ? String(v) : v.toFixed(2);
    return {
      id: c.id,
      code: c.code,
      kind: KIND_LABEL[c.kind],
      value: c.type === "PERCENT" ? `${amount}% off` : `$${amount} off`,
      uses: c.maxUses != null ? `${c.uses} / ${c.maxUses}` : String(c.uses),
      active: c.active,
    };
  });
}
export type DiscountCodeView = Awaited<ReturnType<typeof listDiscountCodes>>[number];

/** ZIP codes outside Fairfax County that are also allowed. */
export async function extraZipCodes() {
  const rows = await prisma.allowedZipCode.findMany({ where: { fairfaxCounty: false }, orderBy: { zipCode: "asc" }, select: { zipCode: true } });
  return rows.map((r) => r.zipCode);
}

export async function blocklistEntries() {
  const rows = await prisma.blocklist.findMany({ orderBy: { blockedAt: "desc" }, select: { email: true } });
  return rows.map((r) => r.email);
}

/** Officials who have worked league matches, for the officials picker. */
export async function refereeNames() {
  const rows = await prisma.match.findMany({ select: { ref1: true, ref2: true, ref3: true } });
  const names = new Set<string>();
  for (const r of rows) for (const n of [r.ref1, r.ref2, r.ref3]) if (n?.trim()) names.add(n.trim());
  return [...names].sort((a, b) => a.localeCompare(b));
}
