/**
 * Who can do what in the current league, from OrganizationMember. Roles are per league: being an
 * admin in one league gives nothing in another. (Captains are team-scoped; see team-access.ts.)
 */
import type { OrgRole } from "@prisma/client";
import { db, getOrgId } from "@/lib/db";
import { effectiveRole } from "@/platform/identity";
import { getSession } from "@/lib/session";
import { ForbiddenError, UnauthorizedError } from "@/lib/team-access";

/** Roles that run the league office (the /admin area). */
export const OFFICE_ROLES: OrgRole[] = ["OWNER", "ADMIN"];
export const isOfficeRole = (role: OrgRole | null | undefined) => !!role && OFFICE_ROLES.includes(role);
/** Roles that can open the league office; STAFF sees it read-only (every write needs OWNER or ADMIN). */
export const VIEW_OFFICE_ROLES: OrgRole[] = ["OWNER", "ADMIN", "STAFF"];
export const canViewOffice = (role: OrgRole | null | undefined) => !!role && VIEW_OFFICE_ROLES.includes(role);

/** A user's role in the current league (membership, or the operator impersonating), or null. */
export async function currentMembership(userId: string) {
  return effectiveRole(userId, await getOrgId());
}

/**
 * For server actions and route handlers: the signed-in user must have one of `roles` in the
 * current league. Returns the user and their role.
 */
export async function requireOrgRole(roles: OrgRole[]) {
  const session = await getSession();
  if (!session?.user) throw new UnauthorizedError("Sign in to continue.");
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { id: true, email: true } });
  if (!user) throw new UnauthorizedError("Sign in to continue.");
  const m = await currentMembership(user.id);
  if (!m || !roles.includes(m.role)) throw new ForbiddenError("Only the league office can do that.");
  return { ...user, role: m.role };
}
