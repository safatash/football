import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { teamSelect } from "@/lib/queries/teams";

export type TeamAccess = "captain" | "admin" | "player";

/**
 * What the signed-in user may do on a team. Permissions are per team: captain = an active
 * seasonal roster row with isCaptain on this team; admins can do everything; other members of
 * the team can read and print.
 */
export async function getTeamAccess(teamId: string) {
  const session = await getSession();
  const user = session?.user;
  if (!user) return { user: null, team: null, access: null } as const;
  const team = await db.team.findUnique({ where: { id: teamId }, select: teamSelect });
  if (!team) return { user, team: null, access: null } as const;

  const membership = user.playerId
    ? await db.teamRoster.findFirst({
        where: { teamId, playerId: user.playerId, leftAt: null },
        select: { isCaptain: true, membershipType: true },
        orderBy: { isCaptain: "desc" },
      })
    : null;
  const access: TeamAccess | null =
    membership?.isCaptain && membership.membershipType === "SEASONAL" ? "captain" : user.isAdmin ? "admin" : membership ? "player" : null;
  return { user, team, access } as const;
}

export class ForbiddenError extends Error {
  status = 403 as const;
}
export class UnauthorizedError extends Error {
  status = 401 as const;
}

/** For server actions / routes: captain of this team or admin, otherwise throws (401/403). */
export async function requireCaptain(teamId: string) {
  const res = await getTeamAccess(teamId);
  if (!res.user) throw new UnauthorizedError("Sign in to continue.");
  if (!res.team) throw new ForbiddenError("Team not found.");
  if (res.access !== "captain" && res.access !== "admin") throw new ForbiddenError("Only this team’s captains can do that.");
  return { user: res.user, team: res.team, access: res.access };
}

/** Teams the user captains (active seasonal captain rows), newest season first. */
export async function captainedTeams(playerId: string | undefined) {
  if (!playerId) return [];
  const rows = await db.teamRoster.findMany({
    where: { playerId, isCaptain: true, leftAt: null, membershipType: "SEASONAL" },
    select: { team: { select: teamSelect } },
    orderBy: [{ team: { season: { startDate: "desc" } } }, { joinedAt: "asc" }],
  });
  return rows.map((r) => r.team);
}
