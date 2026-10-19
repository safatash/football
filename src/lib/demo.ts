/**
 * Demo (seed) data. Seeded teams have `isDemo`; seeded people use @example.com addresses, a domain
 * reserved for examples that no real player can have. League-office accounts are never demo.
 */
import { cache } from "react";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

export const DEMO_EMAIL_DOMAIN = "@example.com";

/** Typed to confirm clearing demo data. */
export const CLEAR_DEMO_PHRASE = "clear demo data";

export const isDemoEmail = (email: string | null | undefined) => !!email && email.toLowerCase().endsWith(DEMO_EMAIL_DOMAIN);

/** Demo accounts (never admins). */
export const demoUserWhere = { email: { endsWith: DEMO_EMAIL_DOMAIN, mode: "insensitive" }, role: { not: "ADMIN" } } satisfies Prisma.UserWhereInput;

/** Matches that involve a demo team. */
export const demoMatchWhere = { OR: [{ homeTeam: { isDemo: true } }, { awayTeam: { isDemo: true } }] } satisfies Prisma.MatchWhereInput;

/** How much demo data is left (all seasons). */
export const demoSummary = cache(async () => {
  const [teams, players, matches] = await Promise.all([
    prisma.team.count({ where: { isDemo: true } }),
    prisma.player.count({ where: { user: demoUserWhere } }),
    prisma.match.count({ where: demoMatchWhere }),
  ]);
  return { teams, players, matches, any: teams + players + matches > 0 };
});
