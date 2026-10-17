import prisma from "@/lib/prisma";
import type { LegacyDb } from "@/lib/legacy-redirects";

/** Prisma-backed lookups for the legacy redirects. */
export const legacyDb: LegacyDb = {
  season: (datasource) =>
    datasource
      ? prisma.season.findFirst({ where: { OR: [{ legacyDatasource: datasource }, { slug: datasource }] }, select: { id: true, slug: true, isActive: true } })
      : prisma.season.findFirst({ where: { isActive: true }, select: { id: true, slug: true, isActive: true }, orderBy: { startDate: "desc" } }),
  team: (seasonId, legacyId) => prisma.team.findUnique({ where: { seasonId_legacyId: { seasonId, legacyId } }, select: { id: true } }),
  division: (seasonId, legacyId) => prisma.division.findUnique({ where: { seasonId_legacyId: { seasonId, legacyId } }, select: { code: true } }),
  match: (seasonId, legacyId) => prisma.match.findUnique({ where: { seasonId_legacyId: { seasonId, legacyId } }, select: { id: true } }),
  player: (legacyKey) => prisma.player.findUnique({ where: { legacyKey }, select: { id: true } }),
};
