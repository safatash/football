/**
 * Organization lookups for the platform layer (proxy, webhooks, crons, operator pages).
 * These use the raw client: organizations themselves aren't league-scoped.
 */
import prisma from "./prisma";

export type OrgRef = { id: string; slug: string; name: string; status: "TRIAL" | "ACTIVE" | "PAST_DUE" | "SUSPENDED" | "CANCELLED"; customDomain: string | null };

const select = { id: true, slug: true, name: true, status: true, customDomain: true } as const;
const TTL_MS = 30_000;
const cache = new Map<string, { at: number; org: OrgRef | null }>();

async function cached(key: string, load: () => Promise<OrgRef | null>) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.org;
  const org = await load();
  cache.set(key, { at: Date.now(), org });
  return org;
}

export const orgBySlug = (slug: string) => cached(`slug:${slug}`, () => prisma.organization.findUnique({ where: { slug }, select }));
export const orgByDomain = (domain: string) => cached(`domain:${domain}`, () => prisma.organization.findUnique({ where: { customDomain: domain }, select }));
export const orgById = (id: string) => cached(`id:${id}`, () => prisma.organization.findUnique({ where: { id }, select }));

/** Forget cached lookups (after an organization's slug, domain or status changes). */
export function forgetOrg() {
  cache.clear();
  brands.clear();
}

/** Leagues that background jobs should run for. */
export function activeOrganizations() {
  return prisma.organization.findMany({ where: { status: { in: ["TRIAL", "ACTIVE", "PAST_DUE"] } }, select, orderBy: { createdAt: "asc" } });
}

/** Statuses that keep a league's public site and player pages closed. */
export const isUnavailable = (status: OrgRef["status"]) => status === "SUSPENDED" || status === "CANCELLED";

/** Everything the pages, emails and theme need about a league (cached like the lookups above). */
const brandSelect = {
  ...select,
  fullName: true,
  tagline: true,
  logoUrl: true,
  primaryColor: true,
  accentColor: true,
  timezone: true,
  contactEmail: true,
  supportEmail: true,
  facebookUrl: true,
  twitterUrl: true,
  instagramUrl: true,
} as const;
export type OrgBrandRow = NonNullable<Awaited<ReturnType<typeof loadBrand>>>;
const loadBrand = (id: string) => prisma.organization.findUnique({ where: { id }, select: brandSelect });
const brands = new Map<string, { at: number; row: OrgBrandRow | null }>();
export async function brandById(id: string) {
  const hit = brands.get(id);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.row;
  const row = await loadBrand(id);
  brands.set(id, { at: Date.now(), row });
  return row;
}
