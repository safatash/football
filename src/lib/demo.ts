/**
 * Demo (seed) data. Seeded teams have `isDemo`; seeded people use @example.com addresses, a domain
 * reserved for examples that no real player can have. League-office accounts are never demo.
 */
import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export const DEMO_EMAIL_DOMAIN = "@example.com";

export { CLEAR_DEMO_PHRASE } from "./demo-phrase";

export const isDemoEmail = (email: string | null | undefined) => !!email && email.toLowerCase().endsWith(DEMO_EMAIL_DOMAIN);

/** Demo accounts (never admins). */
export const demoUserWhere = { email: { endsWith: DEMO_EMAIL_DOMAIN, mode: "insensitive" }, memberships: { none: { role: { in: ["OWNER", "ADMIN"] } } } } satisfies Prisma.UserWhereInput;

/** Matches that involve a demo team. */
export const demoMatchWhere = { OR: [{ homeTeam: { isDemo: true } }, { awayTeam: { isDemo: true } }] } satisfies Prisma.MatchWhereInput;

/** How much demo data is left (all seasons). */
export const demoSummary = cache(async () => {
  const [teams, players, matches, parks, referees] = await Promise.all([
    db.team.count({ where: { isDemo: true } }),
    db.player.count({ where: { user: demoUserWhere } }),
    db.match.count({ where: demoMatchWhere }),
    db.park.count({ where: { isDemo: true } }),
    db.referee.count({ where: { isDemo: true } }),
  ]);
  return { teams, players, matches, parks, referees, any: teams + players + matches + parks + referees > 0 };
});
