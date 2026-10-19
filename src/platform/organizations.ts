/** Platform queries and changes across leagues (the operator area and signup). Raw client by design. */
import { randomBytes } from "node:crypto";
import type { OrganizationStatus, Prisma } from "@prisma/client";
import { hashPassword } from "@/lib/password";
import { isValidSlug, leagueOrigin, RESERVED_SLUGS } from "@/lib/tenant";
import { forgetOrg } from "./orgs";
import prisma from "./prisma";

export const TRIAL_DAYS = 30;
export const STATUSES: OrganizationStatus[] = ["TRIAL", "ACTIVE", "PAST_DUE", "SUSPENDED", "CANCELLED"];

/** Lower-case letters, numbers and dashes, from a league name. */
export const slugify = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

export async function slugAvailability(slug: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (RESERVED_SLUGS.has(slug)) return { ok: false, reason: "That address is reserved." };
  if (!isValidSlug(slug)) return { ok: false, reason: "Use 3–40 lower-case letters, numbers and dashes." };
  if (await prisma.organization.findUnique({ where: { slug }, select: { id: true } })) return { ok: false, reason: "That address is taken." };
  return { ok: true };
}

/** Every league with its size and when anything last happened there. */
export async function listOrganizations() {
  const [orgs, players, audit, regs, pays] = await Promise.all([
    prisma.organization.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true, slug: true, status: true, plan: true, trialEndsAt: true, createdAt: true, customDomain: true } }),
    prisma.player.groupBy({ by: ["organizationId"], _count: { _all: true } }),
    prisma.auditLog.groupBy({ by: ["organizationId"], _max: { createdAt: true } }),
    prisma.registration.groupBy({ by: ["organizationId"], _max: { createdAt: true } }),
    prisma.payment.groupBy({ by: ["organizationId"], _max: { createdAt: true } }),
  ]);
  const by = <T extends { organizationId: string }>(rows: T[]) => new Map(rows.map((r) => [r.organizationId, r]));
  const [p, a, r, y] = [by(players), by(audit), by(regs), by(pays)];
  return orgs.map((o) => {
    const last = [a.get(o.id)?._max.createdAt, r.get(o.id)?._max.createdAt, y.get(o.id)?._max.createdAt].filter((d): d is Date => !!d).sort((m, n) => n.getTime() - m.getTime())[0] ?? null;
    return { ...o, players: p.get(o.id)?._count._all ?? 0, lastActivity: last, url: leagueOrigin(o) };
  });
}
export type OrgListRow = Awaited<ReturnType<typeof listOrganizations>>[number];

/** One league for the operator: details, usage and its office. */
export async function organizationDetail(id: string) {
  const org = await prisma.organization.findUnique({ where: { id } });
  if (!org) return null;
  const w = { organizationId: id };
  const [players, teams, seasons, matches, registrations, paid, office, impersonations] = await Promise.all([
    prisma.player.count({ where: w }),
    prisma.team.count({ where: w }),
    prisma.season.count({ where: w }),
    prisma.match.count({ where: w }),
    prisma.registration.count({ where: w }),
    prisma.payment.aggregate({ where: { ...w, status: "PAID" }, _sum: { amount: true } }),
    prisma.organizationMember.findMany({ where: { ...w, role: { in: ["OWNER", "ADMIN", "STAFF"] }, status: "ACTIVE" }, select: { role: true, user: { select: { email: true } } }, orderBy: { role: "asc" } }),
    prisma.impersonation.findMany({ where: w, orderBy: { startedAt: "desc" }, take: 5, select: { startedAt: true, endedAt: true, expiresAt: true, reason: true, user: { select: { email: true } } } }),
  ]);
  return {
    org,
    url: leagueOrigin(org),
    usage: { players, teams, seasons, matches, registrations, collected: Number(paid._sum.amount ?? 0) },
    office: office.map((m) => ({ role: m.role, email: m.user.email })),
    impersonations,
  };
}

/** Writes an entry to the league's own audit log from the platform. */
export function platformAudit(tx: Prisma.TransactionClient, orgId: string, actor: { id: string; email: string }, entry: { action: string; summary: string; data?: Prisma.InputJsonValue }) {
  return tx.auditLog.create({ data: { organizationId: orgId, actorUserId: actor.id, actorEmail: actor.email, entityType: "organization", entityId: orgId, ...entry } });
}

/**
 * Creates a league in TRIAL (30 days) with its settings and an OWNER. The owner is an existing
 * login (checked by the caller) or a new one with the given password (or none yet: an invite).
 */
export async function createOrganization(input: { name: string; slug: string; ownerEmail: string; ownerPassword?: string | null; plan?: string; status?: OrganizationStatus; contactEmail?: string | null }, actor?: { id: string; email: string }) {
  const avail = await slugAvailability(input.slug);
  if (!avail.ok) throw new Error(avail.reason);
  const result = await prisma.$transaction(async (tx) => {
    const email = input.ownerEmail.trim().toLowerCase();
    let owner = await tx.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
    const newOwner = !owner;
    if (!owner) owner = await tx.user.create({ data: { email, password: await hashPassword(input.ownerPassword || randomBytes(24).toString("base64url")) } });
    const org = await tx.organization.create({
      data: {
        name: input.name.trim(),
        slug: input.slug,
        status: input.status ?? "TRIAL",
        plan: input.plan ?? "trial",
        trialEndsAt: (input.status ?? "TRIAL") === "TRIAL" ? new Date(Date.now() + TRIAL_DAYS * 24 * 3600_000) : null,
        contactEmail: input.contactEmail ?? email,
      },
    });
    await tx.organizationSettings.create({ data: { organizationId: org.id } });
    await tx.organizationMember.create({ data: { organizationId: org.id, userId: owner.id, role: "OWNER", status: "ACTIVE", joinedAt: new Date() } });
    await platformAudit(tx, org.id, actor ?? { id: owner.id, email: owner.email }, { action: actor ? "org.created" : "org.signup", summary: `${input.name.trim()} created (${org.status.toLowerCase()})` });
    return { org, owner, newOwner };
  });
  forgetOrg();
  return result;
}

export async function updateOrganization(id: string, data: { status?: OrganizationStatus; plan?: string; trialEndsAt?: Date | null }, actor: { id: string; email: string }, summary: string) {
  await prisma.$transaction(async (tx) => {
    await tx.organization.update({ where: { id }, data });
    await platformAudit(tx, id, actor, { action: "org.updated", summary, data: JSON.parse(JSON.stringify(data)) });
  });
  forgetOrg();
}

export const IMPERSONATION_MINUTES = 60;

/** Starts the operator acting as this league's admin. */
export async function startImpersonation(orgId: string, actor: { id: string; email: string }, reason: string | null) {
  return prisma.$transaction(async (tx) => {
    await tx.impersonation.updateMany({ where: { userId: actor.id, organizationId: orgId, endedAt: null }, data: { endedAt: new Date() } });
    const imp = await tx.impersonation.create({ data: { organizationId: orgId, userId: actor.id, reason, expiresAt: new Date(Date.now() + IMPERSONATION_MINUTES * 60_000) } });
    await platformAudit(tx, orgId, actor, { action: "impersonation.started", summary: `Platform support (${actor.email}) started acting as an admin${reason ? `: ${reason}` : ""}`, data: { impersonationId: imp.id } });
    return imp;
  });
}

/** Ends it (from the banner on the league's site). */
export async function stopImpersonation(orgId: string, actor: { id: string; email: string }) {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.impersonation.updateMany({ where: { userId: actor.id, organizationId: orgId, endedAt: null }, data: { endedAt: new Date() } });
    if (count) await platformAudit(tx, orgId, actor, { action: "impersonation.stopped", summary: `Platform support (${actor.email}) stopped acting as an admin` });
    return count;
  });
}
