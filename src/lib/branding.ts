/**
 * The current league's name, logo, colors, contact details and public URL. Pages, emails and the
 * theme read these instead of hard-coding a league. Outside a league (platform pages) the app's
 * own name is used.
 */
import { cache } from "react";
import { getOrgId } from "@/lib/db";
import { leagueOrigin } from "@/lib/tenant";
import { brandById } from "@/platform/orgs";

/** The product name ("{League} via {App}" in emails). */
export const appName = () => process.env.APP_NAME || "LeagueKeep";

export type Brand = {
  orgId: string | null;
  slug: string | null;
  name: string;
  fullName: string;
  tagline: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  timezone: string;
  contactEmail: string | null;
  supportEmail: string | null;
  social: { label: string; url: string }[];
  url: string;
  appName: string;
};

/** Brand for the app itself (no league). */
export function platformBrand(): Brand {
  const name = appName();
  return {
    orgId: null,
    slug: null,
    name,
    fullName: name,
    tagline: null,
    logoUrl: null,
    primaryColor: null,
    accentColor: null,
    timezone: "America/New_York",
    contactEmail: null,
    supportEmail: null,
    social: [],
    url: (process.env.APP_ROOT_URL || "http://localhost:3000").replace(/\/$/, ""),
    appName: name,
  };
}

/** Brand for a league by id (webhooks and jobs, or when the id is already known). */
export async function brandFor(orgId: string): Promise<Brand> {
  const o = await brandById(orgId);
  if (!o) return platformBrand();
  const social = [
    o.facebookUrl ? { label: "Facebook", url: o.facebookUrl } : null,
    o.twitterUrl ? { label: "X (Twitter)", url: o.twitterUrl } : null,
    o.instagramUrl ? { label: "Instagram", url: o.instagramUrl } : null,
  ].filter((x): x is { label: string; url: string } => !!x);
  return {
    orgId: o.id,
    slug: o.slug,
    name: o.name,
    fullName: o.fullName || o.name,
    tagline: o.tagline,
    logoUrl: o.logoUrl,
    primaryColor: o.primaryColor,
    accentColor: o.accentColor,
    timezone: o.timezone,
    contactEmail: o.contactEmail,
    supportEmail: o.supportEmail || o.contactEmail,
    social,
    url: leagueOrigin(o),
    appName: appName(),
  };
}

/** The current league's brand (one lookup per request). */
export const getBrand = cache(async (): Promise<Brand> => {
  let orgId: string;
  try {
    orgId = await getOrgId();
  } catch {
    return platformBrand();
  }
  return brandFor(orgId);
});

/** The current league's public origin, for links in emails, Stripe and structured data. */
export async function appUrl() {
  return (await getBrand()).url;
}

/** Where players write for help: the support address, else the contact address. */
export async function helpEmail() {
  const b = await getBrand();
  return b.supportEmail || b.contactEmail || null;
}

/** "Contact office@league.org." for error messages (or the league office when there's no address). */
export async function contactLine() {
  const email = await helpEmail();
  return email ? `Contact ${email}.` : "Contact the league office.";
}
