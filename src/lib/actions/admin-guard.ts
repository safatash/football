/**
 * Server-side helpers shared by the admin actions. Not a "use server" module, so none of this is
 * callable from the browser on its own.
 */
import { db } from "@/lib/db";
import { requireOrgRole } from "@/lib/access";
import { fullName } from "@/lib/format";
import { assertSeasonWritable } from "@/lib/queries/season";
import { ActionError } from "./result";

/** Every admin action re-checks access on the server: OWNER or ADMIN of the current league. */
export async function requireAdminUser() {
  return requireOrgRole(["OWNER", "ADMIN"]);
}

/** A team in the active season, for roster changes. */
export async function teamForRoster(teamId: string) {
  const team = await db.team.findUnique({ where: { id: teamId }, include: { division: true, season: true } });
  if (!team) throw new ActionError("Team not found.", 404);
  await assertSeasonWritable(team.seasonId);
  return team;
}

export async function assertJerseyFree(teamId: string, jersey: number | null, exceptPlayerId?: string) {
  if (jersey == null) return;
  const taken = await db.teamRoster.findFirst({
    where: { teamId, jerseyNumber: jersey, leftAt: null, membershipType: "SEASONAL", ...(exceptPlayerId ? { playerId: { not: exceptPlayerId } } : {}) },
    select: { player: { select: { firstName: true, lastName: true } } },
  });
  if (taken) throw new ActionError(`#${jersey} is already ${fullName(taken.player)}’s number on this team.`, 409);
}

