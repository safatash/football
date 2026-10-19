import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { fulfillGamePass } from "@/lib/game-pass-server";
import { regNumber } from "@/lib/format";
import { sendMail } from "@/lib/mail";
import { registrationReceivedEmail } from "@/lib/mail-templates";
import { syncPaymentStatus } from "@/lib/billing";
import { countDiscountUse } from "@/lib/registration";
import { stripe } from "@/lib/stripe";
import { runWithOrg } from "@/lib/db";
import { orgForCheckout } from "@/platform/checkout";

function readEvent(body: string, signature: string | null): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (secret) return stripe().webhooks.constructEvent(body, signature ?? "", secret);
  // Local development only: accept unsigned events (e.g. `stripe trigger`) when no secret is set
  if (process.env.NODE_ENV !== "production") return JSON.parse(body) as Stripe.Event;
  throw new Error("STRIPE_WEBHOOK_SECRET is not set");
}

/** Registration paid: record the payment, move Submitted → Pending review, count the discount use. */
async function registrationPaid(session: Stripe.Checkout.Session) {
  const registrationId = session.metadata?.registrationId;
  if (!registrationId) throw new Error("Missing registrationId");
  const recorded = await db.$transaction(async (tx) => {
    // Stripe retries webhooks: the checkout session id is stored on the payment
    if (await tx.payment.findUnique({ where: { stripeChargeId: session.id } })) return false;
    const reg = await tx.registration.findUnique({ where: { id: registrationId } });
    if (!reg) throw new Error(`Registration ${registrationId} not found`);
    const payment = await tx.payment.create({
      data: {
        userId: reg.playerId, // Payment.userId references players.id
        stripePaymentIntentId: (session.payment_intent as string | null) ?? null,
        stripeChargeId: session.id,
        amount: (session.amount_total ?? 0) / 100,
        currency: session.currency ?? "usd",
        status: "PAID",
        paymentType: "REGISTRATION_FEE",
        relatedEntityType: "registration",
        relatedEntityId: reg.id,
        method: "STRIPE",
        paidAt: new Date(),
      },
    });
    await tx.registration.update({
      where: { id: reg.id },
      data: { paymentStatus: "PAID", paymentId: payment.id, ...(reg.status === "SUBMITTED" ? { status: "PENDING" } : {}) },
    });
    if (reg.discountCodeId) await countDiscountUse(tx, reg.discountCodeId);
    return true;
  });
  if (!recorded) return;
  const reg = await db.registration.findUniqueOrThrow({
    where: { id: registrationId },
    include: { season: true, division: true, player: { select: { firstName: true, user: { select: { email: true } } } } },
  });
  await sendMail({
    to: reg.player.user.email,
    ...registrationReceivedEmail({ firstName: reg.player.firstName, seasonName: reg.season.name, divisionName: reg.division?.name ?? "the league", number: regNumber(reg.number), paid: true }),
  });
}

/** Balance paid through an emailed payment link: add it to the ledger and recompute the status. */
async function balancePaid(session: Stripe.Checkout.Session) {
  const registrationId = session.metadata?.registrationId;
  if (!registrationId) throw new Error("Missing registrationId");
  await db.$transaction(async (tx) => {
    if (await tx.payment.findUnique({ where: { stripeChargeId: session.id } })) return;
    const reg = await tx.registration.findUnique({ where: { id: registrationId } });
    if (!reg) throw new Error(`Registration ${registrationId} not found`);
    const amount = (session.amount_total ?? 0) / 100;
    await tx.payment.create({
      data: {
        userId: reg.playerId,
        stripePaymentIntentId: (session.payment_intent as string | null) ?? null,
        stripeChargeId: session.id,
        amount,
        currency: session.currency ?? "usd",
        status: "PAID",
        paymentType: "REGISTRATION_FEE",
        relatedEntityType: "registration",
        relatedEntityId: reg.id,
        method: "STRIPE",
        paidAt: new Date(),
      },
    });
    const s = await syncPaymentStatus(tx, reg.id);
    await tx.auditLog.create({
      data: { actorEmail: "stripe", action: "payment.stripe", entityType: "registration", entityId: reg.id, summary: `Paid $${amount} online (payment link)`, data: { session: session.id, status: s.status } },
    });
  });
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = readEvent(body, req.headers.get("stripe-signature"));
  } catch (err) {
    console.error("Webhook signature verification failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") return NextResponse.json({ received: true });
  const session = event.data.object as Stripe.Checkout.Session;
  const type = session.metadata?.type ?? (session.metadata?.registrationId ? "registration" : null);

  if (type !== "registration" && type !== "registration_balance" && type !== "game_pass") {
    console.error("Webhook: unknown checkout type", type);
    return NextResponse.json({ error: "Unknown checkout type" }, { status: 400 });
  }
  // The webhook is a platform route (no league host): run it as the league the checkout belongs to
  const orgId = await orgForCheckout(session.metadata);
  if (!orgId) {
    console.error("Webhook: no league for checkout", session.id);
    return NextResponse.json({ error: "Unknown league" }, { status: 400 });
  }

  try {
    await runWithOrg(orgId, () => (type === "registration" ? registrationPaid(session) : type === "registration_balance" ? balancePaid(session) : fulfillGamePass(session)));
  } catch (error) {
    console.error("Error processing webhook:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
