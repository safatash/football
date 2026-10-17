import { cache } from "react";
import prisma from "@/lib/prisma";

export type SeasonRef = { id: string; name: string; isActive: boolean; startDate: Date; endDate: Date };

export const listSeasons = cache(async (): Promise<SeasonRef[]> =>
  prisma.season.findMany({ select: { id: true, name: true, isActive: true, startDate: true, endDate: true }, orderBy: { startDate: "desc" } }),
);

/** The active season; falls back to the most recent one. */
export const getActiveSeason = cache(async (): Promise<SeasonRef | null> => {
  const seasons = await listSeasons();
  return seasons.find((s) => s.isActive) ?? seasons[0] ?? null;
});

export type ResolvedSeason = SeasonRef & { archived: boolean; activeName: string };

/** Season by name (e.g. from `?season=`), defaulting to the active season. */
export async function resolveSeason(name?: string | null): Promise<ResolvedSeason | null> {
  const [seasons, active] = await Promise.all([listSeasons(), getActiveSeason()]);
  if (!active) return null;
  const picked = (name && seasons.find((s) => s.name === name)) || active;
  return { ...picked, archived: !picked.isActive, activeName: active.name };
}

export const getSettings = cache(async (seasonId: string) => {
  const s = await prisma.leagueSettings.findUnique({ where: { seasonId } });
  return {
    gamePassFee: s ? Number(s.gamePassFee) : 15,
    maxMatchRoster: s?.maxMatchRoster ?? 18,
    fairfaxCountyAllowed: s?.fairfaxCountyAllowed ?? true,
  };
});

/** Throws when the season is closed. Server actions call this before writing season data. */
export async function assertSeasonWritable(seasonId: string) {
  const s = await prisma.season.findUnique({ where: { id: seasonId }, select: { isActive: true, name: true } });
  if (!s) throw new SeasonReadOnlyError("That season doesn’t exist.");
  if (!s.isActive) throw new SeasonReadOnlyError(`${s.name} is closed, so changes are turned off.`);
}

export class SeasonReadOnlyError extends Error {}
