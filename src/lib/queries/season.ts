import { cache } from "react";
import { DEFAULT_GAME_PASS_FEE, DEFAULT_MAX_MATCH_ROSTER } from "@/lib/league-data";
import prisma from "@/lib/prisma";
import { currentOrgId } from "@/lib/org";
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

/**
 * Settings for a season: the league-wide OrganizationSettings with this season's overrides
 * (LeagueSettings) applied.
 */
export const getSettings = cache(async (seasonId: string) => {
  const [season, org] = await Promise.all([
    prisma.leagueSettings.findUnique({ where: { seasonId } }),
    prisma.organizationSettings.findUnique({ where: { organizationId: currentOrgId() } }),
  ]);
  return {
    gamePassFee: season?.gamePassFee != null ? Number(season.gamePassFee) : org ? Number(org.gamePassFee) : DEFAULT_GAME_PASS_FEE,
    maxMatchRoster: season?.maxMatchRoster ?? org?.maxMatchRoster ?? DEFAULT_MAX_MATCH_ROSTER,
    gamePassesEnabled: org?.gamePassesEnabled ?? true,
    eligibilityMode: org?.eligibilityMode ?? ("NONE" as const),
    eligibleCounties: org?.eligibleCounties ?? [],
    /** True when any address in the league's counties is eligible (NVASA: Fairfax County). */
    countyAllowed: org?.eligibilityMode === "COUNTY_LIST",
  };
});

/** Throws when the season is closed. Server actions call this before writing season data. */
export async function assertSeasonWritable(seasonId: string) {
  const s = await prisma.season.findUnique({ where: { id: seasonId }, select: { isActive: true, name: true, endDate: true } });
  if (!s) throw new SeasonReadOnlyError("That season doesn’t exist.");
  if (isSeasonClosed(s)) throw new SeasonReadOnlyError(`${s.name} is over, so changes are turned off.`);
}

export class SeasonReadOnlyError extends Error {}
