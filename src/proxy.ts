import { NextResponse, type NextRequest } from "next/server";
import { ORG_COOKIE, ORG_ID_HEADER, ORG_SLUG_HEADER, devFallbackSlug, parseHost } from "@/lib/tenant";
import { isUnavailable, orgByDomain, orgBySlug, type OrgRef } from "@/platform/orgs";

/** Platform routes that don't belong to a league (they find the league themselves). */
const PLATFORM_PATHS = [/^\/api\/stripe\/webhook$/, /^\/api\/cron\//];
/** What the root domain (and admin.<root>) serves: signup, the operator area and sign-in. */
const PLATFORM_HOST_PATHS = [/^\/$/, /^\/platform(\/|$)/, /^\/signup(\/|$)/, /^\/login(\/|$)/, /^\/api\/auth\//, /^\/favicon\.ico$/];
/** Never on a league's own address. */
const PLATFORM_ONLY = [/^\/platform(\/|$)/, /^\/signup(\/|$)/];
/** Still open while a league is suspended, so its office can sign in and sort out billing. */
const OPEN_WHEN_UNAVAILABLE = [/^\/login(\/|$)/, /^\/api\/auth\//, /^\/admin(\/|$)/, /^\/favicon\.ico$/];

function page(status: number, title: string, body: string) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><meta name="robots" content="noindex">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f4f6f1;color:#13201a;font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}main{max-width:460px;padding:32px 24px;text-align:center}h1{font-size:28px;margin:0 0 10px}p{margin:0;color:#5b6b61}@media (prefers-color-scheme:dark){body{background:#0f1712;color:#e6efe8}p{color:#9fb1a6}}</style></head>
<body><main><h1>${title}</h1><p>${body}</p></main></body></html>`;
  return new NextResponse(html, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

/**
 * Resolves the league for every request from the host (subdomain or custom domain; locally also
 * ?org= / ORG_SLUG) and passes it on in trusted request headers. Unknown hosts get "League not
 * found"; suspended or cancelled leagues get "unavailable" except for login and the office.
 */
export async function proxy(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // The old site's home link was `/?home=1`
  if (pathname === "/" && searchParams.has("home")) {
    const url = req.nextUrl.clone();
    url.searchParams.delete("home");
    return NextResponse.redirect(url, 301);
  }

  const headers = new Headers(req.headers);
  // Never trust a league header sent by the client
  headers.delete(ORG_ID_HEADER);
  headers.delete(ORG_SLUG_HEADER);
  if (PLATFORM_PATHS.some((p) => p.test(pathname))) return NextResponse.next({ request: { headers } });

  const match = parseHost(req.headers.get("host"));
  if (match.kind === "root") {
    // The platform: no league here
    if (!PLATFORM_HOST_PATHS.some((p) => p.test(pathname))) return page(404, "Not found", "This page belongs to a league. Open it on the league’s own address.");
    if (pathname === "/") return NextResponse.redirect(new URL("/signup", `${req.nextUrl.protocol}//${req.headers.get("host")}`));
    return NextResponse.next({ request: { headers } });
  }
  if (PLATFORM_ONLY.some((p) => p.test(pathname))) return page(404, "Not found", "There’s nothing here.");
  let org: OrgRef | null = null;
  let remember: string | null = null;
  if (match.kind === "subdomain") org = await orgBySlug(match.slug);
  else if (match.kind === "custom") org = await orgByDomain(match.domain);
  else {
    const query = searchParams.get("org");
    const slug = devFallbackSlug({ query, cookie: req.cookies.get(ORG_COOKIE)?.value });
    if (slug) org = await orgBySlug(slug);
    if (org && query) remember = org.slug;
  }

  if (!org) return page(404, "League not found", "There’s no league at this address. Check the link, or ask your league for its web address.");
  if (isUnavailable(org.status) && !OPEN_WHEN_UNAVAILABLE.some((p) => p.test(pathname))) {
    return page(503, "This league is unavailable", `${org.name}’s site is paused right now. League staff can still log in.`);
  }

  headers.set(ORG_ID_HEADER, org.id);
  headers.set(ORG_SLUG_HEADER, org.slug);
  const res = NextResponse.next({ request: { headers } });
  if (remember) res.cookies.set(ORG_COOKIE, remember, { path: "/", sameSite: "lax", httpOnly: true });
  return res;
}

export const config = {
  // Everything except Next's own assets and static files
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?|txt)$).*)"],
};
