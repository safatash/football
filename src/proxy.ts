import { NextResponse, type NextRequest } from "next/server";

/** The old site's home link was `/?home=1`; send it to `/` permanently. */
export function proxy(req: NextRequest) {
  if (req.nextUrl.searchParams.has("home")) {
    const url = req.nextUrl.clone();
    url.searchParams.delete("home");
    return NextResponse.redirect(url, 301);
  }
  return NextResponse.next();
}

export const config = { matcher: "/" };
