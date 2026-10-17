/**
 * Scheduled upkeep (run by the cron routes). Not server actions: these run without a user.
 */
import prisma from "@/lib/prisma";
import { now } from "@/lib/clock";
import { syncMatchReportStatus } from "@/lib/reports";

/** Ends suspensions whose end date has passed (cron). Player.status follows the Suspension rows. */
export async function syncSuspensions(at = now()) {
  const players = await prisma.player.findMany({
    where: { status: "SUSPENDED", suspensions: { none: { liftedAt: null, startsAt: { lte: at }, OR: [{ endsAt: null }, { endsAt: { gt: at } }] } } },
    select: { id: true },
  });
  if (players.length) await prisma.player.updateMany({ where: { id: { in: players.map((p) => p.id) } }, data: { status: "ACTIVE" } });
  return players.length;
}

/** Flags reports still missing 48 hours after kickoff (cron). */
export async function markOverdueReports(at = now()) {
  const matches = await prisma.match.findMany({
    where: { reportStatus: { in: ["NOT_STARTED", "DRAFT"] }, status: { not: "CANCELLED" }, scheduledAt: { lt: new Date(at.getTime() - 48 * 3600_000) } },
    select: { id: true },
  });
  for (const m of matches) await prisma.$transaction((tx) => syncMatchReportStatus(tx, m.id, at));
  return matches.length;
}
