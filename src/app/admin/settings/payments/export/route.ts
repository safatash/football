import type { PaymentMethod, PaymentStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { METHODS } from "@/lib/billing";
import { requireAdminUser } from "@/lib/actions/admin-guard";
import { REPORT_STATUSES, paymentsCsv, seasonPayments } from "@/lib/queries/payments-report";
import { resolveSeason } from "@/lib/queries/season";

/** CSV of the Payments report (same season and filters). League office only. */
export async function GET(req: NextRequest) {
  try {
    await requireAdminUser();
  } catch {
    return NextResponse.json({ error: "Only the league office can export payments." }, { status: 403 });
  }
  const sp = req.nextUrl.searchParams;
  const season = await resolveSeason(sp.get("season"));
  if (!season) return NextResponse.json({ error: "Season not found." }, { status: 404 });
  const method = (METHODS.find(([k]) => k === sp.get("method"))?.[0] ?? null) as PaymentMethod | null;
  const status = (REPORT_STATUSES.find(([k]) => k === sp.get("status"))?.[0] ?? null) as PaymentStatus | null;
  const { rows } = await seasonPayments(season.id, { method, status });
  const name = `nvasa-payments-${season.name.toLowerCase().replace(/\s+/g, "-")}${method ? `-${method.toLowerCase()}` : ""}${status ? `-${status.toLowerCase()}` : ""}.csv`;
  return new NextResponse(paymentsCsv(rows), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}"`, "cache-control": "no-store" },
  });
}
