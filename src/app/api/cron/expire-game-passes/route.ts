import { NextResponse, type NextRequest } from "next/server";
import { expireGamePasses } from "@/lib/game-pass-server";
import { forEachLeague } from "@/platform/jobs";

/**
 * Marks game passes EXPIRED after their window and closes their game-pass roster rows, in every active league.
 * Vercel Cron calls it with `Authorization: Bearer $CRON_SECRET` (see vercel.json).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ leagues: await forEachLeague(expireGamePasses) });
}
