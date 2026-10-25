import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { reportError } from "@/lib/monitoring";
import { beginStripeEvent, disconnectAccount, finishStripeEvent, orgForStripeAccount, syncAccount } from "@/platform/payments";

/**
 * Events from leagues' connected (Express) accounts, signed with STRIPE_CONNECT_WEBHOOK_SECRET.
 * The league is found from `event.account`. Each event is logged (StripeEvent) and handled once.
 *   account.updated                  → the league's charges / payouts / details flags
 *   account.application.deauthorized → online payments off until the league connects again
 * Payments themselves are destination charges on the platform account, so they arrive on
 * /api/stripe/webhook.
 */
function readEvent(body: string, signature: string | null): Stripe.Event {
  const secret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
  if (secret) return stripe().webhooks.constructEvent(body, signature ?? "", secret);
  // Local development only: accept unsigned events when no secret is set
  if (process.env.NODE_ENV !== "production") return JSON.parse(body) as Stripe.Event;
  throw new Error("STRIPE_CONNECT_WEBHOOK_SECRET is not set");
}

export async function POST(req: NextRequest) {
  let event: Stripe.Event;
  try {
    event = readEvent(await req.text(), req.headers.get("stripe-signature"));
  } catch (err) {
    console.error("Connect webhook signature verification failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  if (event.type !== "account.updated" && event.type !== "account.application.deauthorized") return NextResponse.json({ received: true });

  const orgId = await orgForStripeAccount(event.account);
  // An account no league owns (e.g. created and abandoned): nothing to update
  if (!orgId) return NextResponse.json({ received: true, ignored: "unknown account" });
  if (!(await beginStripeEvent(event, orgId))) return NextResponse.json({ received: true, duplicate: true });

  try {
    if (event.type === "account.updated") await syncAccount(event.data.object as Stripe.Account);
    else await disconnectAccount(event.account!);
    await finishStripeEvent(event.id);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error handling Connect event:", error);
    reportError(error, { where: "stripe connect webhook", event: event.type });
    await finishStripeEvent(event.id, error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
