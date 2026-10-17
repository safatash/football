import { NextResponse, type NextRequest } from "next/server";
import { legacyDb } from "@/lib/legacy-db";
import { resolveLegacy, type LegacyKind } from "@/lib/legacy-redirects";

/** Route handler factory for an old .cfm URL: always a 301 to the new page. */
export function legacyRedirect(kind: LegacyKind) {
  return async function GET(req: NextRequest) {
    const to = await resolveLegacy(kind, req.nextUrl.searchParams, legacyDb);
    return NextResponse.redirect(new URL(to, req.url), 301);
  };
}

/** A fixed 301 (no lookup). */
export function staticRedirect(to: string) {
  return function GET(req: NextRequest) {
    return NextResponse.redirect(new URL(to, req.url), 301);
  };
}
