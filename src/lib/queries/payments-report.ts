import type { PaymentMethod, PaymentStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { methodLabel } from "@/lib/billing";
import { TZ, fullName } from "@/lib/format";

export const REPORT_STATUSES: [PaymentStatus, string][] = [
  ["PAID", "Paid"],
  ["REFUNDED", "Refunded"],
  ["WAIVED", "Waived"],
  ["UNPAID", "Unpaid"],
  ["FAILED", "Failed"],
];

/**
 * Every payment for a season: registration ledger rows (linked by id or by the original
 * checkout) and game passes for the season's matches. Optional method / status filters.
 */
export async function seasonPayments(seasonId: string, filters: { method?: PaymentMethod | null; status?: PaymentStatus | null } = {}) {
  const regs = await db.registration.findMany({ where: { seasonId }, select: { id: true, paymentId: true } });
  const where: Prisma.PaymentWhereInput = {
    AND: [
      {
        OR: [
          { relatedEntityType: "registration", relatedEntityId: { in: regs.map((r) => r.id) } },
          { id: { in: regs.flatMap((r) => (r.paymentId ? [r.paymentId] : [])) } },
          { gamePass: { match: { seasonId } } },
        ],
      },
      filters.method ? { method: filters.method } : {},
      filters.status ? { status: filters.status } : {},
    ],
  };
  const rows = await db.payment.findMany({
    where,
    include: {
      player: { select: { id: true, firstName: true, lastName: true } },
      recordedBy: { select: { email: true } },
      gamePass: { select: { match: { select: { gameNumber: true } } } },
    },
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
  });
  const list = rows.map((r) => {
    const amount = Number(r.amount);
    return {
      id: r.id,
      playerId: r.player.id,
      date: (r.paidAt ?? r.createdAt).toLocaleDateString("en-CA", { timeZone: TZ }),
      player: fullName(r.player),
      for: r.gamePass ? `Game pass #${r.gamePass.match.gameNumber}` : "Registration",
      status: r.status,
      amount,
      /** Money in is positive, refunds negative, waivers 0 (no money moved). */
      net: r.status === "PAID" ? amount : r.status === "REFUNDED" ? -amount : 0,
      method: methodLabel(r.method ?? (r.stripeChargeId ? "STRIPE" : null)),
      reference: r.reference ?? (r.stripeChargeId ? "Stripe checkout" : ""),
      recordedBy: r.recordedBy?.email ?? (r.stripeChargeId ? "Stripe" : ""),
      notes: r.notes ?? "",
    };
  });
  const sum = (s: PaymentStatus) => list.filter((r) => r.status === s).reduce((a, r) => a + r.amount, 0);
  const totals = { collected: sum("PAID"), refunded: sum("REFUNDED"), waived: sum("WAIVED"), net: sum("PAID") - sum("REFUNDED"), count: list.length };
  return { rows: list, totals };
}

const csvCell = (v: string | number) => {
  const s = String(v);
  // Quote when needed; a leading = + - @ is neutralized so spreadsheets don't run it as a formula
  const safe = /^[=+\-@]/.test(s) && typeof v === "string" ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function paymentsCsv(rows: Awaited<ReturnType<typeof seasonPayments>>["rows"]) {
  const head = ["Date", "Player", "For", "Status", "Amount", "Net", "Method", "Reference", "Recorded by", "Notes"];
  const lines = rows.map((r) => [r.date, r.player, r.for, r.status, r.amount.toFixed(2), r.net.toFixed(2), r.method, r.reference, r.recordedBy, r.notes].map(csvCell).join(","));
  return [head.join(","), ...lines].join("\r\n") + "\r\n";
}
