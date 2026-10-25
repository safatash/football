# LeagueKeep: status after Batch 6 (Oct 24, 2026)

All work is on `saas/multitenant` (latest 0f05772, CI green). `main` is at 8699960 (Batch 1).
Batches 3–6 aren't merged into `main` yet.

## What shipped

| Batch | What |
| --- | --- |
| 1 | `main` merged and pushed; renamed to LeagueKeep (package, README); old plans archived under `docs/archive/`; dev brief committed; stale remote removed. |
| 2 | Vercel project `leaguekeep` connected to `safatash/football`, staging on the Neon branch `rls-bench`. RLS measured on Vercel; **writes-only RLS** shipped as a migration; read-side RLS is in the backlog (brief 4e). |
| 3 | Waiver acceptance recorded and enforced; emergency contact in the wizard and the player profile; registration switch plus season open/close dates; `charge.refunded` and `checkout.session.expired` webhooks. |
| 4 | Rate limits on sign-in, recovery, lookup and registration (Postgres counters) and a bot honeypot; Sentry (off without a DSN, no personal data); `/privacy` placeholder; player self-service account deletion. |
| 5 | Stripe Connect Express in test mode: onboarding, destination charges, a fee of 1% plus Stripe's processing fee, the Connect webhook. NVASA stays on the platform account until its cutover. |
| 6 | Round-robin schedule generator and CSV import; field availability and team blackouts stored as structured rows; forfeits; point adjustments. |

Tests: 263 in 43 files. They pass with RLS off and on against Postgres 16, plus the
no-database run, `tsc`, eslint and `next build`.

## Left from the Phase 0 list

- **Stripe, end to end:** confirm `checkout.session.completed` writes Payments in every
  environment. Needs Stripe test keys and webhook endpoints on staging.
- **Stripe Connect live:** onboard the first real league; NVASA's cutover (section 6 of
  `docs/payments-architecture.md`).
- **Privacy policy text:** the page is a placeholder (TODO legal).
- **Nice to have** (not started): rainout tool, broadcast email, roster freeze date, late fee,
  game-pass cap.

## Decisions needed from you

1. **Go live with Batches 3–6?** That means merging `saas/multitenant` into `main` and applying
   six migrations (`20261025` to `20261030`) to Neon `main`, the production database. Turning on
   RLS there also needs the `nvasa_app` role, `DATABASE_APP_URL` and `DB_RLS=on` in production.
   None of this is done yet.
2. **Vercel production:** the kickoff asked for env vars in both preview and production scopes.
   After your "staging only" message I set Preview only, and production builds are skipped (an
   Ignored Build Step). Keep it that way, or add Production env vars (still the staging database)?
3. **Stripe on staging:** which Stripe account and test keys to use. The current local test key
   belongs to the "NOVA Advertising" account and should be rotated.
4. **Bot protection:** a honeypot plus rate limits for now. Add Vercel BotID or Cloudflare
   Turnstile?
5. **Sentry:** create a project and set `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`.
6. **NVASA's Stripe account:** Standard (its existing account) or a new Express account.
7. **Small product calls:**
   - Emergency contact is required on every registration.
   - Checkout holds a spot for 1 hour.
   - Unconnected leagues take registrations as "pay later".
   - A forfeit is 3–0 and counts toward goal difference.
   - The registration wizard still says "Fairfax County" in its ZIP notice. That's NVASA-specific
     and should come from league settings.
