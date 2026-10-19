import { db } from "@/lib/db";
import { billingSummary, ledgerWhere, methodLabel } from "@/lib/billing";
import { TZ } from "@/lib/format";

const day = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: TZ });
const stamp = (d: Date) => d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: TZ });

/** A player's billing for a season: their latest registration, its ledger and the billing activity. */
export async function playerBilling(playerId: string, seasonId: string) {
  const reg = await db.registration.findFirst({
    where: { playerId, seasonId },
    orderBy: { submittedAt: "desc" },
    include: { division: { select: { name: true, registrationFee: true } }, discountCode: { select: { code: true } } },
  });
  if (!reg) return null;
  const [rows, activity] = await Promise.all([
    db.payment.findMany({ where: ledgerWhere(reg), include: { recordedBy: { select: { email: true } } }, orderBy: [{ paidAt: "asc" }, { createdAt: "asc" }] }),
    db.auditLog.findMany({ where: { entityType: "registration", entityId: reg.id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const summary = billingSummary(
    Number(reg.totalAmount),
    rows.map((r) => ({ amount: Number(r.amount), status: r.status, paymentType: r.paymentType })),
  );
  const KIND: Record<string, string> = { PAID: "Payment", REFUNDED: "Refund", WAIVED: "Waived", UNPAID: "Unpaid", FAILED: "Failed" };
  return {
    registrationId: reg.id,
    fee: reg.amountBeforeDiscount != null ? Number(reg.amountBeforeDiscount) : Number(reg.totalAmount),
    discount: reg.discountCode ? { code: reg.discountCode.code, amount: Math.max(0, Number(reg.amountBeforeDiscount ?? reg.totalAmount) - Number(reg.totalAmount)) } : null,
    division: reg.division?.name ?? null,
    stored: reg.paymentStatus,
    summary,
    ledger: rows.map((r) => ({
      id: r.id,
      date: day(r.paidAt ?? r.createdAt),
      kind: KIND[r.status] ?? r.status,
      amount: Number(r.amount),
      sign: r.status === "REFUNDED" ? -1 : r.status === "PAID" ? 1 : 0,
      method: r.paymentType === "WAIVER" ? "—" : methodLabel(r.method ?? (r.stripeChargeId ? "STRIPE" : null)),
      reference: r.reference ?? (r.stripeChargeId ? "Stripe checkout" : ""),
      recordedBy: r.recordedBy?.email ?? (r.stripeChargeId ? "Stripe" : "—"),
      notes: r.notes ?? "",
    })),
    activity: activity.map((a) => ({ id: a.id, when: stamp(a.createdAt), who: a.actorEmail, summary: a.summary })),
  };
}
export type PlayerBilling = NonNullable<Awaited<ReturnType<typeof playerBilling>>>;
