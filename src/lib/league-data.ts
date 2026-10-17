/**
 * Pure league helpers and constants. League records (divisions, teams, matches, rosters,
 * registrations…) live in the database; see prisma/seed.ts for the Spring 2026 data.
 */
export { ageOn, checkEligibility } from "@/lib/eligibility";
export { initials, money } from "@/lib/format";
export { FORMATIONS } from "@/lib/formations";

/** League defaults; each season's values live in LeagueSettings. */
export const DEFAULT_GAME_PASS_FEE = 15;
export const DEFAULT_MAX_MATCH_ROSTER = 18;
/** Players must be this old on the season's opening day unless a division says otherwise. */
export const DEFAULT_MIN_AGE = 18;
