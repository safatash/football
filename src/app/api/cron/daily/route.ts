import { NextResponse, type NextRequest } from "next/server";
import { markOverdueReports, syncSuspensions } from "@/lib/maintenance";

/**
 * Daily upkeep: reports still missing 48 hours after kickoff become Overdue, and players whose
 * suspension has ended go back to Active. Vercel Cron calls it with `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [overdue, reinstated] = await Promise.all([markOverdueReports(), syncSuspensions()]);
  return NextResponse.json({ overdue, reinstated });
}
