/**
 * Server-side helpers shared by the admin actions. Not a "use server" module, so none of this is
 * callable from the browser on its own.
 */
import prisma from "@/lib/prisma";
import { isAdminUser } from "@/lib/admin";
import { fullName } from "@/lib/format";
import { assertSeasonWritable } from "@/lib/queries/season";
import { getSession } from "@/lib/session";
import { ForbiddenError, UnauthorizedError } from "@/lib/team-access";
import { ActionError } from "./result";

/** Every admin action re-checks access on the server: role ADMIN or an ADMIN_EMAILS address. */
export async function requireAdminUser() {
  const session = await getSession();
  if (!session?.user) throw new UnauthorizedError("Sign in to continue.");
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, email: true, role: true } });
  if (!isAdminUser(user)) throw new ForbiddenError("Only the league office can do that.");
  return user!;
}

/** A team in the active season, for roster changes. */
export async function teamForRoster(teamId: string) {
  const team = await prisma.team.findUnique({ where: { id: teamId }, include: { division: true, season: true } });
  if (!team) throw new ActionError("Team not found.", 404);
  await assertSeasonWritable(team.seasonId);
  return team;
}

export async function assertJerseyFree(teamId: string, jersey: number | null, exceptPlayerId?: string) {
  if (jersey == null) return;
  const taken = await prisma.teamRoster.findFirst({
    where: { teamId, jerseyNumber: jersey, leftAt: null, membershipType: "SEASONAL", ...(exceptPlayerId ? { playerId: { not: exceptPlayerId } } : {}) },
    select: { player: { select: { firstName: true, lastName: true } } },
  });
  if (taken) throw new ActionError(`#${jersey} is already ${fullName(taken.player)}’s number on this team.`, 409);
}

