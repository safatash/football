/**
 * Which league a Stripe Checkout belongs to. New checkouts carry `organizationId` in their
 * metadata; sessions created before multi-tenancy are matched through the registration or match.
 */
import prisma from "./prisma";

export async function orgForCheckout(metadata: Record<string, string> | null | undefined): Promise<string | null> {
  if (!metadata) return null;
  if (metadata.organizationId) {
    const org = await prisma.organization.findUnique({ where: { id: metadata.organizationId }, select: { id: true } });
    return org?.id ?? null;
  }
  if (metadata.registrationId) {
    const reg = await prisma.registration.findUnique({ where: { id: metadata.registrationId }, select: { organizationId: true } });
    return reg?.organizationId ?? null;
  }
  if (metadata.matchId) {
    const match = await prisma.match.findUnique({ where: { id: metadata.matchId }, select: { organizationId: true } });
    return match?.organizationId ?? null;
  }
  return null;
}

/** Which league a Stripe PaymentIntent was paid to (refund events carry no checkout metadata). */
export async function orgForPaymentIntent(paymentIntent: string | null | undefined): Promise<string | null> {
  if (!paymentIntent) return null;
  const payment = await prisma.payment.findUnique({ where: { stripePaymentIntentId: paymentIntent }, select: { organizationId: true } });
  return payment?.organizationId ?? null;
}

/**
 * A connected checkout's metadata names the league's Stripe account as well as the league. Only
 * our server creates sessions, but the two must still agree before money is recorded for a league.
 * Checkouts without an account (platform account, before Connect) pass.
 */
export async function checkoutAccountMatches(orgId: string, metadata: Record<string, string> | null | undefined): Promise<boolean> {
  const account = metadata?.stripeAccountId;
  if (!account) return true;
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { stripeAccountId: true } });
  return org?.stripeAccountId === account;
}
