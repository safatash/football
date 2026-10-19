/**
 * Which league a request is for (pure; the proxy and server code use it).
 *
 *   <slug>.<APP_ROOT_DOMAIN>   e.g. nvasa.app.localhost:3000 (dev), nvasa.example.com (production)
 *   a custom domain            e.g. nvasa.org (Organization.customDomain)
 *   the root domain itself     the platform (signup, operator pages) — no league
 *
 * Local-only fallback (never in production): `?org=<slug>` (remembered in a cookie) or ORG_SLUG.
 */
export const ORG_ID_HEADER = "x-org-id";
export const ORG_SLUG_HEADER = "x-org-slug";
export const ORG_COOKIE = "org_slug";

export const rootDomain = () => (process.env.APP_ROOT_DOMAIN ?? "app.localhost").toLowerCase().replace(/:\d+$/, "");

export type HostMatch = { kind: "subdomain"; slug: string } | { kind: "root" } | { kind: "custom"; domain: string } | { kind: "local" };

const LOCAL = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** Classifies a Host header (port ignored). */
export function parseHost(host: string | null | undefined, root = rootDomain()): HostMatch {
  const h = (host ?? "").toLowerCase().trim().replace(/:\d+$/, "").replace(/\.$/, "");
  if (!h || LOCAL.has(h)) return { kind: "local" };
  if (h === root || h === `www.${root}`) return { kind: "root" };
  if (h.endsWith(`.${root}`)) {
    const slug = h.slice(0, -root.length - 1);
    // One label only: a.b.root is not a league
    return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug) ? { kind: "subdomain", slug } : { kind: "root" };
  }
  return { kind: "custom", domain: h };
}

/** Local work only: the league from ?org=, the org cookie or ORG_SLUG. */
export function devFallbackSlug(opts: { query?: string | null; cookie?: string | null }) {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_ORG_FALLBACK !== "true") return null;
  return opts.query || opts.cookie || process.env.ORG_SLUG || null;
}

export const isValidSlug = (s: string) => /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/.test(s);
