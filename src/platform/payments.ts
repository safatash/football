/**
 * League payments with Stripe Connect Express (docs/payments-architecture.md). Organization's
 * Stripe fields are platform-owned: only this module and the Connect webhook change them. We
 * store account ids only; every call uses the platform's secret key.
 *
 * Test mode only for now: calls are refused with a live key unless STRIPE_ALLOW_LIVE=true.
 */
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import prisma from "./prisma";

export type PaymentAccount = {
  id: string;
  name: string;
  contactEmail: string | null;
  stripeAccountId: string | null;
  stripeChargesEnabled: boolean;
  stripePayoutsEnabled: boolean;
  stripeDetailsSubmitted: boolean;
  platformFeeBps: number;
  legacyPlatformPayments: boolean;
};

/** How a league takes online payments right now. */
export type PaymentsMode = "connected" | "legacy" | "not-ready";

export async function paymentAccount(orgId: string): Promise<PaymentAccount | null> {
  return prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true, contactEmail: true, stripeAccountId: true, stripeChargesEnabled: true, stripePayoutsEnabled: true, stripeDetailsSubmitted: true, platformFeeBps: true, legacyPlatformPayments: true },
  });
}

/** Connected (and Stripe lets it take charges) wins; otherwise the pre-Connect platform account for older leagues. */
export const paymentsMode = (a: Pick<PaymentAccount, "stripeAccountId" | "stripeChargesEnabled" | "legacyPlatformPayments">): PaymentsMode =>
  a.stripeAccountId && a.stripeChargesEnabled ? "connected" : a.legacyPlatformPayments ? "legacy" : "not-ready";

/** The platform's application fee on a charge, in cents. */
export const feeFor = (platformFeeBps: number, totalCents: number) => Math.max(0, Math.round((totalCents * platformFeeBps) / 10_000));

export class StripeLiveModeError extends Error {
  constructor() {
    super("Stripe is in live mode. League payments run in test mode until STRIPE_ALLOW_LIVE=true.");
  }
}

/** Test keys only, unless live mode is turned on explicitly. */
export function assertStripeMode() {
  if ((process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_live") && process.env.STRIPE_ALLOW_LIVE !== "true") throw new StripeLiveModeError();
}

/**
 * Starts (or continues) Express onboarding: creates the league's account the first time, then an
 * Account Link that sends the office to Stripe. Returns the link's URL.
 */
export async function startOnboarding(orgId: string, urls: { returnUrl: string; refreshUrl: string; leagueUrl: string }) {
  assertStripeMode();
  const org = await paymentAccount(orgId);
  if (!org) throw new Error("No such league");
  let accountId = org.stripeAccountId;
  if (!accountId) {
    const account = await stripe().accounts.create({
      type: "express",
      country: "US",
      email: org.contactEmail ?? undefined,
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      business_profile: { name: org.name, url: urls.leagueUrl },
      metadata: { organizationId: org.id },
    });
    // Two clicks at once: the first account saved wins
    const saved = await prisma.organization.updateMany({ where: { id: org.id, stripeAccountId: null }, data: { stripeAccountId: account.id, stripeAccountUpdatedAt: new Date() } });
    accountId = saved.count ? account.id : (await paymentAccount(org.id))!.stripeAccountId!;
  }
  const link = await stripe().accountLinks.create({ account: accountId, type: "account_onboarding", return_url: urls.returnUrl, refresh_url: urls.refreshUrl });
  return link.url;
}

/** Mirrors a Stripe account's state onto its league (account.updated, or after returning from onboarding). */
export async function syncAccount(account: Pick<Stripe.Account, "id" | "charges_enabled" | "payouts_enabled" | "details_submitted">) {
  const res = await prisma.organization.updateMany({
    where: { stripeAccountId: account.id },
    data: { stripeChargesEnabled: account.charges_enabled, stripePayoutsEnabled: account.payouts_enabled, stripeDetailsSubmitted: account.details_submitted, stripeAccountUpdatedAt: new Date() },
  });
  return res.count > 0;
}

/** Re-reads the league's account from Stripe (the return page doesn't wait for the webhook). */
export async function refreshAccount(orgId: string) {
  const org = await paymentAccount(orgId);
  if (!org?.stripeAccountId) return org;
  assertStripeMode();
  await syncAccount(await stripe().accounts.retrieve(org.stripeAccountId));
  return paymentAccount(orgId);
}

/** A one-time link to the league's Express dashboard (payouts, disputes, tax forms). */
export async function dashboardLink(orgId: string) {
  const org = await paymentAccount(orgId);
  if (!org?.stripeAccountId) return null;
  assertStripeMode();
  return (await stripe().accounts.createLoginLink(org.stripeAccountId)).url;
}

/** The league that owns a connected account (Connect webhooks carry `event.account`). */
export async function orgForStripeAccount(accountId: string | null | undefined) {
  if (!accountId) return null;
  return (await prisma.organization.findUnique({ where: { stripeAccountId: accountId }, select: { id: true } }))?.id ?? null;
}

/** The league disconnected our platform: it can't take charges until it connects again. */
export async function disconnectAccount(accountId: string) {
  await prisma.organization.updateMany({ where: { stripeAccountId: accountId }, data: { stripeChargesEnabled: false, stripePayoutsEnabled: false, stripeAccountUpdatedAt: new Date() } });
}

/**
 * Records an event before handling it. Returns false when it was already processed (Stripe
 * retries); a failed earlier attempt is handled again.
 */
export async function beginStripeEvent(event: Pick<Stripe.Event, "id" | "type" | "account">, leagueId: string | null) {
  const existing = await prisma.stripeEvent.findUnique({ where: { id: event.id } });
  if (existing?.processedAt) return false;
  await prisma.stripeEvent.upsert({
    where: { id: event.id },
    update: { error: null },
    create: { id: event.id, type: event.type, account: event.account ?? null, leagueId },
  });
  return true;
}

export async function finishStripeEvent(id: string, error?: unknown) {
  await prisma.stripeEvent.update({ where: { id }, data: error ? { error: String(error instanceof Error ? error.message : error).slice(0, 500) } : { processedAt: new Date(), error: null } });
}
