import { db } from "@/lib/db";
import { getOrgId } from "@/lib/org";
import type { LegacyDb } from "@/lib/legacy-redirects";

/** Prisma-backed lookups for the legacy redirects. */
export const legacyDb: LegacyDb = {
  season: (datasource) =>
    datasource
      ? db.season.findFirst({ where: { OR: [{ legacyDatasource: datasource }, { slug: datasource }] }, select: { id: true, slug: true, isActive: true } })
      : db.season.findFirst({ where: { isActive: true }, select: { id: true, slug: true, isActive: true }, orderBy: { startDate: "desc" } }),
  team: (seasonId, legacyId) => db.team.findUnique({ where: { seasonId_legacyId: { seasonId, legacyId } }, select: { id: true } }),
  division: (seasonId, legacyId) => db.division.findUnique({ where: { seasonId_legacyId: { seasonId, legacyId } }, select: { code: true } }),
  match: (seasonId, legacyId) => db.match.findUnique({ where: { seasonId_legacyId: { seasonId, legacyId } }, select: { id: true } }),
  player: async (legacyKey) => db.player.findUnique({ where: { organizationId_legacyKey: { organizationId: await getOrgId(), legacyKey } }, select: { id: true } }),
};
