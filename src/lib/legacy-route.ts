import { NextResponse, type NextRequest } from "next/server";
import { legacyDb } from "@/lib/legacy-db";
import { resolveLegacy, type LegacyKind } from "@/lib/legacy-redirects";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/branding";

/** Only leagues that came from the old ColdFusion site (NVASA) answer its .cfm links. */
async function legacyEnabled() {
  const s = await db.organizationSettings.findFirst({ select: { legacyRedirects: true } });
  return !!s?.legacyRedirects;
}
const notFound = () => new NextResponse("Not found", { status: 404 });

/** Route handler factory for an old .cfm URL: a 301 to the new page. */
export function legacyRedirect(kind: LegacyKind) {
  return async function GET(req: NextRequest) {
    if (!(await legacyEnabled())) return notFound();
    const to = await resolveLegacy(kind, req.nextUrl.searchParams, legacyDb);
    return NextResponse.redirect(new URL(to, await appUrl()), 301);
  };
}

/** A fixed 301 (no lookup). */
export function staticRedirect(to: string) {
  return async function GET() {
    if (!(await legacyEnabled())) return notFound();
    return NextResponse.redirect(new URL(to, await appUrl()), 301);
  };
}
