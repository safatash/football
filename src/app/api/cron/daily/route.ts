import { NextResponse, type NextRequest } from "next/server";
import { markOverdueReports, syncSuspensions } from "@/lib/maintenance";
import { forEachLeague } from "@/platform/jobs";
import { pruneRateLimits } from "@/platform/rate-limit";

/**
 * Daily upkeep: reports still missing 48 hours after kickoff become Overdue, and players whose
 * suspension has ended go back to Active, in every active league; old rate-limit windows are
 * deleted. Vercel Cron calls it with `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const leagues = await forEachLeague(async () => {
    const [overdue, reinstated] = await Promise.all([markOverdueReports(), syncSuspensions()]);
    return { overdue, reinstated };
  });
  const rateLimitsPruned = await pruneRateLimits();
  return NextResponse.json({ leagues, rateLimitsPruned });
}
