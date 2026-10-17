import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import prisma from "@/lib/prisma";
import { fulfillGamePass } from "@/lib/game-pass-server";
import { countDiscountUse } from "@/lib/registration";
import { stripe } from "@/lib/stripe";

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
  await prisma.$transaction(async (tx) => {
    // Stripe retries webhooks: the checkout session id is stored on the payment
    if (await tx.payment.findUnique({ where: { stripeChargeId: session.id } })) return;
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
        paidAt: new Date(),
      },
    });
    await tx.registration.update({
      where: { id: reg.id },
      data: { paymentStatus: "PAID", paymentId: payment.id, ...(reg.status === "SUBMITTED" ? { status: "PENDING" } : {}) },
    });
    if (reg.discountCodeId) await countDiscountUse(tx, reg.discountCodeId);
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

  try {
    if (type === "registration") await registrationPaid(session);
    else if (type === "game_pass") await fulfillGamePass(session);
    else {
      console.error("Webhook: unknown checkout type", type);
      return NextResponse.json({ error: "Unknown checkout type" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error processing webhook:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
