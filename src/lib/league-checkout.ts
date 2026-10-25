/**
 * Every online payment to a league (registration, balance links, game passes) goes through
 * `createLeagueCheckout`:
 *   - connected league: a destination charge to its Express account (`on_behalf_of` makes the
 *     league the merchant of record) with the platform's application fee (platformFeeBps);
 *   - older league not yet connected (legacyPlatformPayments): the platform's account, as before;
 *   - otherwise: no online payment (`OnlinePaymentsUnavailable`); callers fall back to "pay later".
 * The session's metadata names the league and the account, and the webhook checks they agree.
 */
import type Stripe from "stripe";
import { getOrgId } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { assertStripeMode, feeFor, paymentAccount, paymentsMode, type PaymentsMode } from "@/platform/payments";

export class OnlinePaymentsUnavailable extends Error {
  constructor() {
    super("Online payments aren’t set up for this league yet. The league office will tell you how to pay.");
  }
}

/** How the current league takes online payments. */
export async function leaguePaymentsMode(): Promise<PaymentsMode> {
  const account = await paymentAccount(await getOrgId());
  return account ? paymentsMode(account) : "not-ready";
}

type CheckoutParams = Omit<Stripe.Checkout.SessionCreateParams, "metadata" | "payment_intent_data"> & { metadata: Record<string, string> };

const totalCents = (items: Stripe.Checkout.SessionCreateParams.LineItem[] = []) => items.reduce((sum, i) => sum + (i.price_data?.unit_amount ?? 0) * (i.quantity ?? 1), 0);

export async function createLeagueCheckout(params: CheckoutParams): Promise<Stripe.Checkout.Session> {
  const orgId = await getOrgId();
  const account = await paymentAccount(orgId);
  const mode = account ? paymentsMode(account) : "not-ready";
  if (mode === "not-ready" || !account) throw new OnlinePaymentsUnavailable();
  assertStripeMode();

  const metadata = { ...params.metadata, organizationId: orgId };
  if (mode === "legacy") return stripe().checkout.sessions.create({ ...params, metadata, payment_intent_data: { metadata: { organizationId: orgId } } });

  const destination = account.stripeAccountId!;
  const fee = feeFor(account.platformFeeBps, totalCents(params.line_items));
  return stripe().checkout.sessions.create({
    ...params,
    metadata: { ...metadata, stripeAccountId: destination, applicationFee: String(fee) },
    payment_intent_data: {
      on_behalf_of: destination,
      transfer_data: { destination },
      ...(fee > 0 ? { application_fee_amount: fee } : {}),
      metadata: { organizationId: orgId },
    },
  });
}

/** Payment fields for the ledger from a completed session's metadata (null = platform account). */
export function connectFields(metadata: Record<string, string> | null | undefined) {
  const fee = metadata?.applicationFee;
  return { stripeAccountId: metadata?.stripeAccountId || null, applicationFeeAmount: fee && /^\d+$/.test(fee) ? Number(fee) / 100 : null };
}
