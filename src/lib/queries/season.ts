import { cache } from "react";
import { DEFAULT_GAME_PASS_FEE, DEFAULT_MAX_MATCH_ROSTER } from "@/lib/league-data";
import prisma from "@/lib/prisma";
import { now } from "@/lib/clock";

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

/**
 * A season is closed (read-only) once it's over: not the active season and its end date has
 * passed. Upcoming seasons stay editable so the office can set up teams and matches ahead of time.
 */
export const isSeasonClosed = (s: { isActive: boolean; endDate: Date }, at = now()) => !s.isActive && s.endDate.getTime() < at.getTime();

/** Season by name (e.g. from `?season=`), defaulting to the active season. */
export async function resolveSeason(name?: string | null): Promise<ResolvedSeason | null> {
  const [seasons, active] = await Promise.all([listSeasons(), getActiveSeason()]);
  if (!active) return null;
  const picked = (name && seasons.find((s) => s.name === name)) || active;
  return { ...picked, archived: isSeasonClosed(picked), activeName: active.name };
}

export const getSettings = cache(async (seasonId: string) => {
  const s = await prisma.leagueSettings.findUnique({ where: { seasonId } });
  return {
    gamePassFee: s ? Number(s.gamePassFee) : DEFAULT_GAME_PASS_FEE,
    maxMatchRoster: s?.maxMatchRoster ?? DEFAULT_MAX_MATCH_ROSTER,
    fairfaxCountyAllowed: s?.fairfaxCountyAllowed ?? true,
  };
});

/** Throws when the season is closed. Server actions call this before writing season data. */
export async function assertSeasonWritable(seasonId: string) {
  const s = await prisma.season.findUnique({ where: { id: seasonId }, select: { isActive: true, name: true, endDate: true } });
  if (!s) throw new SeasonReadOnlyError("That season doesn’t exist.");
  if (isSeasonClosed(s)) throw new SeasonReadOnlyError(`${s.name} is over, so changes are turned off.`);
}

export class SeasonReadOnlyError extends Error {}
