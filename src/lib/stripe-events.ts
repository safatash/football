/**
 * Stripe events beyond a completed checkout. Both run as the league the payment belongs to
 * (the webhook resolves it first) and are safe to receive more than once.
 *
 *   charge.refunded           → a REFUND row in the billing ledger for the newly refunded amount
 *   checkout.session.expired  → an unpaid registration gives up the spot it was holding
 */
import type Stripe from "stripe";
import { db, getOrgId } from "@/lib/db";
import { syncPaymentStatus } from "@/lib/billing";
import { now } from "@/lib/clock";

const cents = (n: number) => Math.round(n * 100) / 100;

export type RefundResult = { recorded: number; paymentId: string | null; reason?: "unknown-payment" | "already-recorded" };

/**
 * Records a refund made in Stripe (dashboard or API). `amount_refunded` is cumulative, so only the
 * part not yet in the ledger is added. The original payment row is locked while counting, so two
 * partial refunds arriving together can't both count the same money, and the row's Stripe key
 * makes a retried event a no-op. A fully refunded game pass is cancelled and leaves the roster.
 */
export async function recordStripeRefund(charge: Pick<Stripe.Charge, "id" | "payment_intent" | "amount_refunded" | "currency">): Promise<RefundResult> {
  const paymentIntent = typeof charge.payment_intent === "string" ? charge.payment_intent : (charge.payment_intent?.id ?? null);
  if (!paymentIntent) return { recorded: 0, paymentId: null, reason: "unknown-payment" };
  const orgId = await getOrgId();

  return db.$transaction(async (tx) => {
    const original = await tx.payment.findFirst({ where: { stripePaymentIntentId: paymentIntent, paymentType: { in: ["REGISTRATION_FEE", "GAME_PASS"] } } });
    if (!original) return { recorded: 0, paymentId: null, reason: "unknown-payment" as const };
    await tx.$executeRaw`SELECT 1 FROM payments WHERE id = ${original.id} AND "organizationId" = ${orgId} FOR UPDATE`;

    const prior = await tx.payment.aggregate({ where: { paymentType: "REFUND", reference: charge.id }, _sum: { amount: true } });
    const refundedTotal = charge.amount_refunded / 100;
    const amount = cents(refundedTotal - Number(prior._sum.amount ?? 0));
    if (amount <= 0) return { recorded: 0, paymentId: null, reason: "already-recorded" as const };

    const row = await tx.payment.create({
      data: {
        userId: original.userId,
        // One row per cumulative total: a retried event hits this unique key
        stripeChargeId: `${charge.id}:refunded:${charge.amount_refunded}`,
        stripePaymentIntentId: null,
        amount,
        currency: charge.currency ?? original.currency,
        status: "REFUNDED",
        paymentType: "REFUND",
        relatedEntityType: original.relatedEntityType,
        relatedEntityId: original.relatedEntityId,
        method: "STRIPE",
        reference: charge.id,
        notes: "Refunded in Stripe",
        paidAt: now(),
      },
    });

    let summary = "";
    if (original.relatedEntityType === "registration" && original.relatedEntityId) {
      const s = await syncPaymentStatus(tx, original.relatedEntityId);
      summary = `, registration now ${s.status.toLowerCase()}`;
    } else if (original.relatedEntityType === "game_pass" && original.relatedEntityId && refundedTotal >= Number(original.amount)) {
      const cancelled = await tx.gamePass.updateMany({ where: { id: original.relatedEntityId, status: "ACTIVE" }, data: { status: "CANCELLED" } });
      if (cancelled.count) await tx.teamRoster.updateMany({ where: { gamePassId: original.relatedEntityId, leftAt: null }, data: { leftAt: now() } });
      summary = cancelled.count ? ", game pass cancelled" : "";
    }
    await tx.auditLog.create({
      data: {
        actorEmail: "stripe",
        action: "payment.stripe_refund",
        entityType: original.relatedEntityType ?? "payment",
        entityId: original.relatedEntityId ?? original.id,
        summary: `Refunded $${amount.toFixed(2)} in Stripe${summary}`,
        data: { charge: charge.id, paymentId: original.id, refundId: row.id, amountRefunded: refundedTotal },
      },
    });
    return { recorded: amount, paymentId: row.id };
  });
}

/**
 * A registration checkout expired without payment: cancel the registration (it was blocking the
 * player from registering again and sat in the office queue) and drop its pending captain request.
 * Anything already paid, approved or cancelled is left alone. Other checkout types hold nothing.
 */
export async function releaseExpiredCheckout(session: Pick<Stripe.Checkout.Session, "id" | "metadata">): Promise<boolean> {
  const type = session.metadata?.type ?? (session.metadata?.registrationId ? "registration" : null);
  const registrationId = session.metadata?.registrationId;
  if (type !== "registration" || !registrationId) return false;

  return db.$transaction(async (tx) => {
    const reg = await tx.registration.findUnique({ where: { id: registrationId } });
    if (!reg || reg.status !== "SUBMITTED" || reg.paymentStatus !== "UNPAID" || reg.paymentId) return false;
    if (await tx.payment.findFirst({ where: { relatedEntityType: "registration", relatedEntityId: reg.id } })) return false;
    // Only if it's still in the state we checked (a payment can land at the same time)
    const done = await tx.registration.updateMany({ where: { id: reg.id, status: "SUBMITTED", paymentStatus: "UNPAID" }, data: { status: "CANCELLED" } });
    if (!done.count) return false;
    await tx.captainRequest.deleteMany({ where: { registrationId: reg.id, status: "PENDING" } });
    await tx.auditLog.create({
      data: {
        actorEmail: "stripe",
        action: "registration.checkout_expired",
        entityType: "registration",
        entityId: reg.id,
        summary: "Checkout expired without payment; registration cancelled",
        data: { session: session.id },
      },
    });
    return true;
  });
}
