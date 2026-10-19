import type { DbTx } from "@/lib/db";
import type { ReportStatus } from "@prisma/client";
import { REPORT_GRACE_MS } from "@/lib/queries/matches";

/**
 * Match.reportStatus summarizes the two team reports: Confirmed once the office confirms one,
 * Submitted while any is waiting for confirmation, Overdue when nothing is submitted 48 hours after
 * kickoff, Draft when a captain has started one.
 */
export function summarizeReportStatus(reports: { status: ReportStatus }[], scheduledAt: Date, at: Date): ReportStatus {
  if (reports.some((r) => r.status === "CONFIRMED")) return "CONFIRMED";
  if (reports.some((r) => r.status === "SUBMITTED")) return "SUBMITTED";
  if (at.getTime() - scheduledAt.getTime() > REPORT_GRACE_MS) return "OVERDUE";
  return reports.length ? "DRAFT" : "NOT_STARTED";
}

export async function syncMatchReportStatus(tx: DbTx, matchId: string, at: Date) {
  const match = await tx.match.findUniqueOrThrow({ where: { id: matchId }, select: { scheduledAt: true, reports: { select: { status: true } } } });
  const reportStatus = summarizeReportStatus(match.reports, match.scheduledAt, at);
  await tx.match.update({ where: { id: matchId }, data: { reportStatus } });
  return reportStatus;
}
