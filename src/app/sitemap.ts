import type { MetadataRoute } from "next";
import prisma from "@/lib/prisma";
import { appUrl } from "@/lib/stripe";

// Rendered on request (not at build time), so builds don't need the database.
export const dynamic = "force-dynamic";

/** Public pages plus this season's teams, players and matches. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = appUrl();
  const fixed: MetadataRoute.Sitemap = ["", "/standings", "/results", "/schedule", "/teams", "/register"].map((p) => ({ url: `${base}${p}`, changeFrequency: "daily" }));
  const season = await prisma.season.findFirst({ where: { isActive: true }, select: { id: true } }).catch(() => null);
  if (!season) return fixed;
  const rows = await Promise.all([
    prisma.team.findMany({ where: { seasonId: season.id }, select: { id: true, updatedAt: true } }),
    prisma.division.findMany({ where: { seasonId: season.id }, select: { code: true } }),
    prisma.match.findMany({ where: { seasonId: season.id, status: { not: "CANCELLED" } }, select: { id: true, updatedAt: true } }),
    prisma.player.findMany({
      where: { teamMemberships: { some: { membershipType: "SEASONAL", leftAt: null, team: { seasonId: season.id } } }, finalApproval: "APPROVED" },
      select: { id: true, updatedAt: true },
    }),
  ]).catch((e) => {
    console.error("Sitemap query failed", e);
    return null;
  });
  if (!rows) return fixed;
  const [teams, divisions, matches, players] = rows;
  return [
    ...fixed,
    ...divisions.map((d) => ({ url: `${base}/divisions/${d.code}`, changeFrequency: "weekly" as const })),
    ...teams.map((t) => ({ url: `${base}/teams/${t.id}`, lastModified: t.updatedAt, changeFrequency: "weekly" as const })),
    ...matches.map((m) => ({ url: `${base}/matches/${m.id}`, lastModified: m.updatedAt })),
    ...players.map((p) => ({ url: `${base}/players/${p.id}`, lastModified: p.updatedAt })),
  ];
}
