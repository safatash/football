/**
 * Logins are shared across leagues (one User, one password); everything else is per league. These
 * lookups take the league explicitly so they also work on the platform host, where there is none.
 */
import type { OrgRole } from "@prisma/client";
import prisma from "./prisma";

/** The current league, or null on the platform host (root domain). */
export async function currentOrgIdOrNull(): Promise<string | null> {
  const { getOrgId } = await import("./db");
  try {
    return await getOrgId();
  } catch {
    return null;
  }
}

const userInclude = (orgId: string | null) => ({ players: { where: { organizationId: orgId ?? "-" }, take: 1 } }) as const;

export const userByEmail = (email: string, orgId: string | null) =>
  prisma.user.findFirst({ where: { email: { equals: email.trim(), mode: "insensitive" } }, include: userInclude(orgId) });
export const userById = (id: string, orgId: string | null) => prisma.user.findUnique({ where: { id }, include: userInclude(orgId) });
export const platformFlags = (id: string) => prisma.user.findUnique({ where: { id }, select: { id: true, email: true, isPlatformAdmin: true } });

/** The operator's live impersonation of this league, if any. */
export function activeImpersonation(userId: string, orgId: string) {
  return prisma.impersonation.findFirst({
    where: { userId, organizationId: orgId, endedAt: null, expiresAt: { gt: new Date() }, user: { isPlatformAdmin: true } },
    orderBy: { startedAt: "desc" },
  });
}

export type EffectiveRole = { role: OrgRole; impersonating: false } | { role: "ADMIN"; impersonating: true; impersonationId: string; expiresAt: Date };

/** A user's role in a league: their active membership, else an operator impersonating as ADMIN. */
export async function effectiveRole(userId: string, orgId: string): Promise<EffectiveRole | null> {
  const m = await prisma.organizationMember.findFirst({ where: { userId, organizationId: orgId, status: "ACTIVE" } });
  if (m) return { role: m.role, impersonating: false };
  const imp = await activeImpersonation(userId, orgId);
  return imp ? { role: "ADMIN", impersonating: true, impersonationId: imp.id, expiresAt: imp.expiresAt } : null;
}

/**
 * Who may sign in where: on a league's address, its active members (and the operator); on the
 * platform host, only the operator.
 */
export async function canSignIn(user: { id: string; isPlatformAdmin: boolean }, orgId: string | null) {
  if (user.isPlatformAdmin) return true;
  if (!orgId) return false;
  return !!(await prisma.organizationMember.findFirst({ where: { userId: user.id, organizationId: orgId, status: "ACTIVE" }, select: { id: true } }));
}
