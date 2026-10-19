# Payments per league: architecture proposal

Status: **proposal only, nothing built.** Written for Phase 5 of the multi-tenant work.
Covers two separate flows of money:

1. **League payments**: players pay a league for registrations, balances and game passes. With
   **Stripe Connect (Express accounts)** that money goes to the league's own bank account, and the
   platform takes an **application fee** on each charge.
2. **Platform billing**: a league pays us for the software. That uses **Stripe Billing**
   (subscriptions) on the platform's own Stripe account.

They share one Stripe platform account but are kept apart in the code and in the data.

---

## 1. Where we are today

| Piece | Today |
| --- | --- |
| Stripe account | One account for everything. `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` in the environment, test mode, API version `2025-02-24.acacia` (`src/lib/stripe.ts`). |
| Checkouts | Three creators, each building a one-off `price_data` line item (no Stripe Products): registration (`src/app/api/register/new/route.ts`), pay-your-balance links (`src/app/api/pay/[id]/route.ts`) and game passes (`src/app/api/game-pass/checkout/route.ts`). Since Phase 2 each sends `metadata.organizationId`. |
| Webhook | `src/app/api/stripe/webhook/route.ts` handles `checkout.session.completed` for `registration`, `registration_balance` and `game_pass`. It finds the league from `metadata.organizationId` (older sessions: from the registration or match), then runs as that league (`runWithOrg`). It's idempotent per session: the session id is stored in `Payment.stripeChargeId`. |
| Ledger | `Payment` rows per league (PAID, PARTIAL, WAIVED, REFUNDED). The registration's status comes from its ledger (`syncPaymentStatus` in `src/lib/billing.ts`). The office also records cash, checks and other offline payments. |
| Refunds | Recorded in the app (a `REFUND` row plus an audit entry), but the money goes back **outside** the app (Stripe dashboard, check). |
| Platform billing | None. Leagues are `TRIAL` / `ACTIVE` / … by hand on `/platform`. |

What this means: today every online payment, for every league, lands in **one** Stripe balance.
That's fine for NVASA alone. It isn't fine once a second league takes money.

---

## 2. Schema additions

### On `Organization` (platform-owned, not league-editable)

```prisma
model Organization {
  // … existing fields …

  // Stripe Connect: the league's own Express account (league payments)
  stripeAccountId        String?   @unique  // acct_…
  stripeChargesEnabled   Boolean   @default(false) // mirrors account.charges_enabled
  stripePayoutsEnabled   Boolean   @default(false) // mirrors account.payouts_enabled
  stripeDetailsSubmitted Boolean   @default(false)
  stripeAccountUpdatedAt DateTime?

  // Stripe Billing: the league as our customer (platform billing)
  stripeCustomerId       String?   @unique  // cus_…
  subscriptionId         String?   @unique  // sub_…
  subscriptionStatus     String?            // trialing | active | past_due | canceled | unpaid …
  currentPeriodEnd       DateTime?

  // What we take per league payment, set by plan (basis points + fixed cents)
  applicationFeeBps      Int       @default(0)
  applicationFeeCents    Int       @default(0)
}
```

We store **ids only**, never per-league API keys. Everything goes through the platform's secret key,
with `stripeAccount` / `transfer_data` naming the league.

### On `Payment` (league ledger)

```prisma
model Payment {
  // … existing fields …
  stripeAccountId      String?  // the league account the money went to (null = legacy/platform)
  stripeCheckoutId     String?  @unique // cs_… (today this lives in stripeChargeId; rename on migration)
  applicationFeeAmount Decimal? @db.Decimal(10, 2) // what the platform kept
  stripeRefundId       String?  @unique // re_… for REFUND rows created through Stripe
}
```

`stripeChargeId` currently holds the **Checkout Session id**. The migration moves it to
`stripeCheckoutId` and starts storing the real charge id (`ch_…`) in `stripeChargeId`.

### New platform tables (not league-scoped; only `src/platform/` touches them)

```prisma
/// Every Stripe event we've handled, for idempotency and debugging.
model StripeEvent {
  id             String   @id            // evt_…
  type           String
  account        String?                 // event.account for Connect events
  organizationId String?
  receivedAt     DateTime @default(now())
  processedAt    DateTime?
  error          String?
}
```

---

## 3. League payments with Connect (Express)

### Onboarding (Admin › Settings › Payments, and the setup checklist's "Connect payments" step)

1. An OWNER or ADMIN clicks **Connect payments**. The server creates an Express account
   (`accounts.create({ type: "express", country: "US", capabilities: { card_payments, transfers },
   business_profile: { name, url: leagueOrigin } })`) and saves `stripeAccountId`.
2. It creates an Account Link (`account_onboarding`) with `return_url` / `refresh_url` on the
   **league's own address**, and redirects there. Stripe collects the league's identity and bank
   details. We never see them.
3. The `account.updated` webhook (Connect) updates the `stripeChargesEnabled` /
   `stripePayoutsEnabled` / `stripeDetailsSubmitted` flags. The page shows "Ready", "Needs more
   information" (a new Account Link) or "Under review".
4. **Open Stripe dashboard** uses `accounts.createLoginLink` (Express dashboard: payouts, disputes,
   tax forms).

Until `stripeChargesEnabled` is true, online checkout is **off** for that league. Registration
still works: it goes to "pay later", and the office records cash or check, as today.

### Charges: destination charges with `on_behalf_of` (recommended)

All three checkout creators move into one platform helper,
`createLeagueCheckout(org, { lineItems, metadata, successUrl, cancelUrl })`, which adds:

```ts
payment_intent_data: {
  on_behalf_of: org.stripeAccountId,          // the league is the merchant of record
  transfer_data: { destination: org.stripeAccountId },
  application_fee_amount: feeFor(org, totalCents),
  statement_descriptor_suffix: shortName(org), // "LEAGUEOFFICE* NVASA"-style on statements
  metadata: { organizationId, … },
},
metadata: { organizationId, type, … }          // unchanged from today
```

Why destination charges and not direct charges:

| | Destination + `on_behalf_of` (recommended) | Direct charges |
| --- | --- | --- |
| Where the charge lives | Platform account; funds transferred to the league | League account |
| Our webhook | Charge and Checkout events arrive on **our** account (today's endpoint keeps working) | Every event comes from the connected account (Connect endpoint only) |
| Merchant of record / statement | The league (because of `on_behalf_of`) | The league |
| Refunds | We call `refunds.create({ payment_intent, reverse_transfer: true })` | Refund on the league account |
| Disputes | Debited from the platform balance, then recovered from the league (transfer reversal) | Debited from the league |
| Fit for Express | Stripe's recommended pattern | Usually used with Standard accounts |

The dispute liability is the main cost of destination charges. At league scale (registrations of
$45–$120) that's acceptable. We'll keep a small platform reserve and use the
`charge.dispute.created` webhook to alert the league and audit it.

### Application fee

`feeFor(org, cents) = round(cents * org.applicationFeeBps / 10_000) + org.applicationFeeCents`,
set from the plan. Stripe's own processing fee is charged to the platform on destination charges,
so the application fee has to cover it plus our margin. For example, 2.9% + 30¢ (Stripe) plus our
cut is roughly `applicationFeeBps = 400, applicationFeeCents = 30`.

Option, per league: **pass the fee to players** as a visible "Online processing fee" line item, so
the league keeps the full fee and the player pays the processing cost.

### Refunds from the app

The Billing panel's **Refund** gets a "Refund to card" option for Stripe payments. It calls
`refunds.create({ payment_intent, amount, reverse_transfer: true, refund_application_fee: <policy> })`
and records the `REFUND` row with `stripeRefundId`. The `charge.refunded` webhook confirms it (and
catches refunds made from the Stripe dashboard). Cash and check refunds stay as today.

---

## 4. Webhooks and routing to the right league

Two endpoints, each with its own signing secret:

| Endpoint | Receives | Secret |
| --- | --- | --- |
| `/api/stripe/webhook` (exists) | Platform-account events: `checkout.session.completed`, `charge.refunded`, `charge.dispute.*` (destination charges live here), and Billing events: `customer.subscription.*`, `invoice.*` | `STRIPE_WEBHOOK_SECRET` |
| `/api/stripe/connect-webhook` (new) | Events from connected accounts: `account.updated`, `account.application.deauthorized`, `payout.failed` | `STRIPE_CONNECT_WEBHOOK_SECRET` |

Both are platform routes with no league host. `src/proxy.ts` already exempts
`/api/stripe/webhook`; add `/api/stripe/connect-webhook` to `PLATFORM_PATHS`. The handling for each
event:

1. Verify the signature, then **insert `StripeEvent`**. If it's already processed, return 200
   (Stripe retries).
2. Find the league:
   - league payments: `metadata.organizationId` (already sent), **cross-checked** against the
     league that owns `transfer_data.destination` / `on_behalf_of` (or `event.account` for
     Connect events). If they disagree, reject and alert. Metadata alone shouldn't be trusted
     once several leagues share the platform.
   - Billing: `Organization.stripeCustomerId = event.data.object.customer`.
3. `runWithOrg(orgId, handler)`, so the handler uses the league-scoped client exactly as today.
4. Mark the `StripeEvent` processed, or store the error and return 500 so Stripe retries.

Changes to existing code:

- `src/app/api/stripe/webhook/route.ts`: the event log, the cross-check, and the new events (refunds,
  disputes, Billing). The three `checkout.session.completed` handlers stay as they are. They also
  save `stripeAccountId` and `applicationFeeAmount` on the `Payment`.
- `src/platform/checkout.ts`: becomes the place that resolves *and verifies* the league for an event.
- The three checkout creators call `createLeagueCheckout` and refuse online payment when the league
  isn't connected.
- `success_url` pages (`register/success`, `game-pass/confirmation`) retrieve the session as today.
  No `stripeAccount` header is needed, because the session lives on the platform account.

Local testing: `stripe listen --forward-to localhost:3000/api/stripe/webhook --forward-connect-to localhost:3000/api/stripe/connect-webhook`.

---

## 5. Platform billing (the league's subscription to us)

- **Products and prices** on the platform account, one per plan (e.g. "Club" monthly and yearly).
  Creating them is a Stripe product change, so it happens only with your OK.
- On signup (Phase 4), the league is `TRIAL` with `trialEndsAt`. Before the trial ends, the setup
  checklist and an admin banner offer **Choose a plan**: Stripe Checkout in `subscription` mode for
  the league's `stripeCustomerId` (created on first use), `trial_end` = `trialEndsAt`.
- **Manage billing** opens the Stripe Customer Portal (card, invoices, cancel).
- Webhooks set `Organization.status`:

| Stripe | Organization.status |
| --- | --- |
| `trialing`, `active` | `ACTIVE` (or `TRIAL` while trialing) |
| `past_due` | `PAST_DUE`: the site stays up; banner for the office |
| `unpaid`, or `past_due` beyond a 14-day grace period | `SUSPENDED`: public site "unavailable", the office can still sign in and pay (Phase 2 behavior) |
| `canceled` | `CANCELLED` |

- The plan also sets `applicationFeeBps` / `applicationFeeCents` (lower fees on higher plans).
- Founding or pilot leagues can stay on manual status from `/platform` with no subscription.

Platform billing and league payments **never mix**. Subscriptions are charged to the league's
customer on our account and never touch its Connect balance. We don't deduct fees from league
payouts to pay the subscription (a possible later option: `application_fee` on top of the plan).

---

## 6. NVASA's current Stripe setup

Today NVASA's online payments go through the one platform key. The test key in use belongs to a
Stripe account named **"NOVA Advertising"**. Before going live, confirm which legal entity should
receive NVASA's money. Also, rotate that test key; it was printed in a tool log earlier.

Proposed cutover:

1. **Decide NVASA's account type.**
   - If NVASA (the association) already has its own Stripe account with payment history, connect it
     as a **Standard** account (OAuth). It keeps its dashboard, history and payouts. Use direct
     charges for Standard, or keep destination charges.
   - Otherwise create an **Express** account for NVASA like any other league.
2. Set NVASA's fee (e.g. `founding` plan: 0 bps, or cost recovery only).
3. Turn on Connect for NVASA after the season's registration rush. From then on, new checkouts
   carry `transfer_data.destination = NVASA's account`.
4. **History stays as it is.** Existing `Payment` rows keep `stripeAccountId = null` (the platform
   account). Balance links and refunds for those payments are handled on the platform account. The
   webhook's fallback for old sessions (metadata without `organizationId`) stays until no open
   sessions remain (Checkout sessions expire after 24 hours).
5. Any money NVASA has collected on the platform account is paid out to NVASA, by manual transfer
   or the existing payout, and reconciled with the Payments report. This is a one-time step.

No Stripe products, prices or webhooks change until you approve this plan.

---

## 7. Security and operations

- Platform secret keys only in the environment (Vercel). Leagues never hold keys. Consider a
  **restricted key** limited to Checkout, PaymentIntents, Refunds, Accounts and Billing.
- Verify signatures on both webhook endpoints. Log and alert when an event's league can't be
  determined or the cross-check fails.
- Only OWNER / ADMIN can start onboarding, refund to card, or change billing. Every action is
  audited (as today).
- No card data in our database (Stripe Checkout only), so we stay at PCI SAQ-A.
- A daily cron (per league, Phase 2 pattern) reconciles `Payment` rows against Stripe balance
  transactions and flags differences.
- 1099-K and tax forms for leagues are handled by Stripe for Express accounts. Leagues that are
  non-profits enter that during onboarding.

---

## 8. Build plan (when approved)

1. Schema migration (section 2) and the `StripeEvent` log. Backfill `stripeCheckoutId`.
2. `createLeagueCheckout` plus the "not connected → pay later" fallback, and tests that each checkout
   carries the league's destination and fee.
3. Connect onboarding (Settings › Payments, setup checklist step), `account.updated`, the Connect
   webhook endpoint.
4. Refund to card and the dispute webhooks.
5. Platform billing: products (with your OK), Checkout in subscription mode, the Customer Portal,
   status sync, and the past-due banner.
6. NVASA cutover (section 6).
7. Isolation tests: a Demo League event can't record a payment in NVASA, even with forged
   metadata; refunds only reverse the league's own transfers.

## 9. Questions for you

1. Who should own NVASA's money: an existing NVASA Stripe account (Standard) or a new Express account?
2. The application fee model: a flat percentage per plan, or a "processing fee" passed to players?
3. Are we comfortable carrying dispute liability with destination charges, or should high-risk
   leagues use direct charges?
4. Plans and prices for the subscription (and whether pilot leagues pay at all).
