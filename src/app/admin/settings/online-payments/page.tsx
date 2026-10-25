import { PageHeading } from "@/components/league";
import { Badge } from "@/components/ui/badge";
import { Card, Notice } from "@/components/ui/card";
import { getBrand } from "@/lib/branding";
import { getOrgId } from "@/lib/db";
import { getSession } from "@/lib/session";
import { paymentAccount, paymentsMode, refreshAccount, stripeProcessingFee } from "@/platform/payments";
import { ConnectButtons } from "./connect-buttons";

export const metadata = { title: "Online payments" };

/** Settings › Online payments: the league's Stripe Express account (docs/payments-architecture.md). */
export default async function OnlinePaymentsPage({ searchParams }: { searchParams: Promise<{ stripe?: string }> }) {
  const [orgId, session, sp, brand] = await Promise.all([getOrgId(), getSession(), searchParams, getBrand()]);
  // Back from Stripe: read the account now instead of waiting for the webhook
  let account = sp.stripe === "return" ? await refreshAccount(orgId).catch(() => null) : null;
  account ??= await paymentAccount(orgId);
  if (!account) return null;
  const mode = paymentsMode(account);
  const readOnly = !session?.user?.isAdmin;
  const pct = (bps: number) => (bps / 100).toLocaleString("en-US", { maximumFractionDigits: 2 });
  const fee = pct(account.platformFeeBps);
  const processing = stripeProcessingFee();

  const status =
    mode === "connected"
      ? { tone: "ok" as const, label: "Ready", text: `Online payments go to ${brand.name}’s Stripe account and are paid out to its bank.` }
      : account.stripeAccountId && account.stripeDetailsSubmitted
        ? { tone: "warn" as const, label: "Under review", text: "Stripe is checking the details. This usually takes a few minutes, sometimes a day or two." }
        : account.stripeAccountId
          ? { tone: "warn" as const, label: "Needs more information", text: "Stripe still needs some details before you can take payments." }
          : { tone: "neutral" as const, label: "Not connected", text: `Connect a Stripe account to take registration and game-pass payments online. Stripe asks for ${brand.name}’s details and bank account; we never see them.` };

  return (
    <>
      <PageHeading title="Online payments" sub="Registrations, balances and game passes are paid by card through Stripe, straight to your league’s account." />
      {sp.stripe === "refresh" ? <Notice tone="info">That Stripe link expired. Continue where you left off.</Notice> : null}
      {mode === "legacy" ? (
        <Notice tone="info" title="Payments use the platform’s Stripe account for now.">
          {brand.name} took online payments before connected accounts existed. Connect your own account to receive them directly; until then, nothing changes for players.
        </Notice>
      ) : null}
      {mode === "not-ready" ? (
        <Notice tone="warn" title="Online payments are off.">
          Players can still register: their registration goes to the office unpaid, and you collect by payment link once connected, or by cash or check. Game passes need online payment.
        </Notice>
      ) : null}
      <Card className="flex max-w-[640px] flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl">Stripe account</h2>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
        <p className="text-muted">{status.text}</p>
        {account.stripeAccountId ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted">Card payments</dt>
            <dd>{account.stripeChargesEnabled ? "On" : "Not yet"}</dd>
            <dt className="text-muted">Payouts to your bank</dt>
            <dd>{account.stripePayoutsEnabled ? "On" : "Not yet"}</dd>
          </dl>
        ) : null}
        <p className="text-sm text-muted">
          Fees on each online payment: platform fee {fee}%{account.platformFeeBps === 0 ? " (waived)" : ""}, plus card processing ({pct(processing.bps)}% + {processing.cents}¢), which Stripe charges.
          The rest goes to your account.
        </p>
        <ConnectButtons
          connectLabel={mode === "connected" ? null : account.stripeAccountId ? "Continue Stripe setup" : "Connect payments"}
          dashboard={!!account.stripeAccountId && account.stripeDetailsSubmitted}
          disabled={readOnly}
        />
        {readOnly ? <p className="text-xs text-muted">Only an owner or admin can change this.</p> : null}
      </Card>
    </>
  );
}
