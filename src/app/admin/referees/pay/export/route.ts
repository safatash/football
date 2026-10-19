import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/actions/admin-guard";
import { now } from "@/lib/clock";
import { addDays, fmtDateEastern, payReport } from "@/lib/queries/referees";

const cell = (v: string | number) => {
  const s = String(v);
  const safe = typeof v === "string" && /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** Referee pay for a date range, one row per assignment. League office only. */
export async function GET(req: NextRequest) {
  try {
    await requireAdminUser();
  } catch {
    return NextResponse.json({ error: "Only the league office can export referee pay." }, { status: 403 });
  }
  const iso = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
  const to = iso(req.nextUrl.searchParams.get("to")) || fmtDateEastern(now());
  const from = iso(req.nextUrl.searchParams.get("from")) || addDays(to, -27);
  const rows = await payReport(from, to);
  const head = ["Referee", "Email", "Date", "Game", "Match", "Role", "Status", "Fee", "Paid"];
  const lines = rows.flatMap((r) => r.lines.map((l) => [r.name, r.email ?? "", l.date, l.gameNumber, l.match, l.role, l.status, l.fee.toFixed(2), l.paid ? "yes" : "no"].map(cell).join(",")));
  return new NextResponse([head.join(","), ...lines].join("\r\n") + "\r\n", {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="nvasa-referee-pay-${from}-to-${to}.csv"`, "cache-control": "no-store" },
  });
}
