# LeagueKeep: dev brief

*From league app to sellable SaaS + WordPress plugin. The product is called **LeagueKeep** (target domain leaguekeep.app). NVASA is now just one prospect league.*

> For the Claude Code dev session working in the `safatash/football` repo (local folder `nvasa-prototype`, branch `saas/multitenant`). This brief turns the go-to-market plan (Oct 24, 2026) into engineering work. Work phase by phase. Stop after each phase, show what changed, run the tests, and wait for an OK. If anything here conflicts with how the code actually works, say so and propose an alternative rather than guessing.

---

## 0. Current status (Oct 24, 2026): read this first

> **Update (Oct 24, late):** Step 0 is done. `saas/multitenant` is merged into `main` (fast-forward) and pushed; the package is `leaguekeep`; the `foundation` remote is gone; and the `leaguekeep` Vercel staging project is connected to the repo and uses the `rls-bench` Neon branch. Writes-only RLS is shipped as a migration. The repo state below is as of the evening.

**Repo state (re-checked Oct 24, evening)**
- `saas/multitenant` and `redesign/ui` are pushed to GitHub and match `origin`. The latest commit is b42710d (Oct 20).
- Local `main` is 14 commits ahead of `origin/main` and hasn't been pushed. `saas/multitenant` isn't merged into `main` yet.
- One uncommitted change: `scripts/rls-local.ts`.
- A stale `foundation` remote points to an old container path. `package.json` is still named `nvasa-prototype`.
- No Vercel project exists for this app yet.

**What exists**
- **Stack:** Next.js 16, Prisma (35 models), Neon Postgres, NextAuth, Stripe, Vercel Blob, Vitest. There are 20 unit test files plus 14 integration test files, including tenant-isolation tests and an RLS latency test.
- **Players:** season and game-pass registration with Stripe Checkout, webhook and expiry; player portal; retrieve-info; email login links and password reset.
- **Captains:** captain tools with per-team authorization.
- **Admin league office:**
  - seasons, divisions (copy from a previous season, limits), teams, matches, players, rosters
  - billing ledger, payment links, waive/discount, payments CSV
  - parks/fields, referees with assignments and pay, audit log
- **Public pages:** results, schedule, standings, teams, team, player, division, match; legacy `.cfm` redirects; sitemap.
- **Multi-tenant:** organizations, memberships, scoped client, an RLS prototype behind `DB_RLS`, league branding, platform admin, signup, impersonation, and `docs/payments-architecture.md` (Stripe Connect design).

**Confirmed still missing (checked in code today; matches the Oct 20 gap audit)**
- **Registration:** nothing sets `Registration.waiverAcceptedAt`. Emergency contact is captured only in the admin add-player form. `registrationOpen` isn't read, and there are no season open/close dates.
- **Payments:** no `charge.refunded` or `checkout.session.expired` webhook handlers. No Stripe Connect code yet.
- **Security and compliance:** no rate limiting, no Sentry, no privacy page, no account deletion.
- **League operations:** no schedule generator or CSV schedule import, no forfeits or point deductions, no playoffs, rainout tool or broadcast email.
- **Housekeeping:** `TODO.md` and `PRODUCTION_PLAN.md` are stale, and `package.json` is still named `nvasa-prototype`.

**Step 0, before any new feature**
1. Commit or discard the `scripts/rls-local.ts` change, and remove the stale `foundation` remote.
2. Merge `saas/multitenant` into `main` once the tests pass, then push `main`.
3. Rename the package (`leaguekeep`) and the README to LeagueKeep.
4. Set up a staging deploy: a new Vercel project named `leaguekeep`, connected to the GitHub repo and using its own Neon branch, never the production database. Add a wildcard subdomain for leagues.

---

## 1. Product decisions (already made, so don't revisit)

- **The product is called LeagueKeep.** The target domain is leaguekeep.app (also leaguekeep.io). Neither is registered yet. Always read the name and domain from `APP_NAME` / `APP_ROOT_DOMAIN`, defaulting to `LeagueKeep` / `leaguekeep.app`; never hardcode them. "NVASA" may appear only as one Organization's data, its seed, and its legacy `.cfm` redirects.
- **Terminology: say "soccer", never "football".** This applies to UI copy, emails, docs, code identifiers and seed data. The GitHub repo `safatash/football` can be renamed later (GitHub redirects old URLs).
- **The hosted Next.js app is the product.** It's a multi-tenant SaaS: each league is an `Organization`.
- **WordPress is a distribution channel, not the product.** We'll ship a thin, free WordPress.org "connector" plugin that embeds a league's public data (schedule, standings, teams, registration link) on the league's existing WP site. All business logic stays on our servers. The plugin only calls our API.
- **Why:** self-contained premium plugins are the shrinking category, because they're easy to copy and vibe-code. Our moat is the hosted service: payments, multi-league isolation, season operations.
- **NVASA is a prospect, not a guaranteed client.** It may never sign. Build so the product stands on its own: NVASA's data is the seed for the demo league and the "Adult rec (NVASA-style)" template, and real customers can be any league.
- **First market:** adult recreational soccer leagues (NVASA-style). Don't build multi-sport yet, but don't hardcode soccer-only assumptions where a neutral name works just as well.
- **Revenue model:**
  - a league subscription through Stripe Billing
  - plus a 1% platform fee on registration payments through Stripe Connect Express (application fee)
  - a Pro/Agency license unlocks white-label widgets in the WP plugin
- **No lifetime deals**, ever.

### Plans (starting hypotheses, so make every value configurable and never hardcode)

| Plan | Price | Limits / features |
| --- | --- | --- |
| Trial | Free for 30 days | Full League features |
| Starter | $39/mo or $390/yr | Up to 16 teams, 1 admin, registration and payments |
| League | $89/mo or $890/yr | Up to 60 teams, referees, fields, game passes, staff roles, custom domain |
| Pro / Agency add-on | $199/yr | White-label WP widgets (no "Powered by"), manage multiple league sites |
| Platform fee | 1% of registration payments | Stripe Connect application fee, collected on top of Stripe's own fees |
| Design partners (first 3 leagues, NVASA or others) | Free for one season | All features. A `comped` flag with an end date, not a fake discount |

---

## 2. Phase 0: finish and prove it with one real league (top priority)

Goal: one real league (NVASA if it signs, otherwise the first design partner) runs a full season on the platform with no data or payment incidents. Recruiting design partners runs in parallel, so nothing waits on NVASA.

Pull from `claude/nvasa-gap-audit-2026-10-19.md` (Project doc) and section 0 above. Must-haves before the season:

- [x] **Waiver:** set `Registration.waiverAcceptedAt` in the registration wizard, and enforce it when `OrganizationSettings` requires a waiver.
- [x] **Emergency contact:** collect it in the registration wizard and the player profile, not only in the admin add-player form.
- [x] **Registration open/close:** read `OrganizationSettings.registrationOpen`, and add season open/close dates.
- [ ] **Stripe webhooks:** handle `charge.refunded` and `checkout.session.expired` (**done**, Batch 3), and confirm `checkout.session.completed` writes Payment records in every environment (still open: it needs a Stripe test-mode webhook on staging).
- [ ] **Stripe Connect Express:** (Built in Batch 5, test mode. The application fee is 1% plus Stripe's processing fee, so the league pays processing. Still open: onboarding a live league and NVASA's cutover.) implement it per `docs/payments-architecture.md`, and onboard the first live league onto a connected account. Application fee = `platformFeeBps` on Organization (default 100, 0 for comped design partners).
- [x] **Security:** rate limiting and bot protection on login, retrieve, password reset and registration. (Batch 4: Postgres counters and a honeypot. A stronger bot check, such as Vercel BotID or Turnstile, is an open decision.)
- [x] **Monitoring and compliance:** Sentry, a privacy policy page, and account deletion. (Batch 4. The privacy text is a placeholder: TODO(legal).)
- [ ] **Scheduling:** a round-robin schedule generator and/or CSV schedule import.
- [ ] **Standings:** forfeits and point deductions.
- [ ] **Docs:** clean up the stale `TODO.md` / `PRODUCTION_PLAN.md` and the create-next-app README header.

Nice to have in Phase 0 (otherwise it moves to Phase 3): rainout tool, broadcast email, roster freeze date, late fee, game-pass cap.

**Gate 1:** the first real league's season runs end to end (registration → payments → schedule → results → standings) with zero data-isolation or payment incidents.

---

## 3. Phase 1: pilot readiness (months 1–3 after the NOVA sale closes)

The goal is to onboard 3–5 pilot leagues with no hand-holding beyond a call.

- [ ] **Product name and domain:** set `APP_NAME=LeagueKeep` and `APP_ROOT_DOMAIN=leaguekeep.app`, and use them everywhere. "NVASA" must appear only as an Organization's data.
- [ ] **Self-serve signup and setup checklist:** confirm the Phase 4 flow from the multi-league prompt works end to end for a brand-new league: league profile, first season, divisions and fees, fields, invite staff, connect Stripe.
- [ ] **Season templates:** "Adult rec league (NVASA-style)", "Indoor / futsal", "7v7 summer", and "Blank".
- [ ] **Demo league:** a seeded, read-only public demo org (`demo.<root>`), built from NVASA-style data with fake names, for sales calls and the WP.org plugin screenshots. This is the main proof asset if NVASA doesn't sign.
- [ ] **Pilot flags:** `Organization.isPilot`, plus a platform-area view of pilot health (last admin login, players registered, payments processed).
- [ ] **Help center:** at minimum a `/help` area with markdown docs for the setup checklist steps.

**Gate 2:** 3 pilot leagues are active, and at least 2 say they'd pay at the listed price.

---

## 4. Phase 2: launch (months 4–6)

### 4a. Subscription billing (Stripe Billing)

- [ ] **Organization fields:** add `stripeCustomerId`, `subscriptionId`, `plan` (enum: TRIAL / STARTER / LEAGUE), `billingInterval`, `addons` (PRO_AGENCY), `comped` and `platformFeeBps`.
- [ ] **Checkout:** use Stripe Checkout for subscriptions and the Stripe Customer Portal for upgrades, downgrades, cancellations and invoices.
- [ ] **Webhook state:** subscription webhooks drive `Organization.status` (ACTIVE / PAST_DUE / SUSPENDED / CANCELLED). The existing "league unavailable" page and admin billing access must keep working.
- [ ] **Plan limits:** enforce them in one place, a single `getPlanLimits(org)` helper. Examples: team count, admin seats, custom domain, referees module. When a limit is hit, show a soft block with an upgrade prompt and never lose data.
- [ ] **Tests:** cover the trial expiry, downgrade-over-limit and past-due flows.

### 4b. Public API for the WordPress plugin

- [ ] **Versioned endpoints:** a read-only, versioned public API `/api/public/v1/{orgSlug}/...` with:
  - `seasons`
  - `divisions`
  - `schedule` (filters: division, team, date range)
  - `results`
  - `standings`
  - `teams`
  - `teams/{id}`
  - `registration-link`
- [ ] **Public data only:** never expose player PII. Lock this in with a test for each endpoint.
- [ ] **Org-scoped API keys:** for the WP plugin, created in Admin → Settings → Integrations. Public endpoints work without a key, but a key unlocks Pro features and higher rate limits.
- [ ] **Caching:** cache headers and ETags, with revalidation tied to the existing org-scoped cache tags.
- [ ] **CORS and rate limiting:** set both per org.
- [ ] **Widget embed fallback:** `/embed/{orgSlug}/{widget}` iframe or web component, so non-WordPress sites (Wix, Squarespace) can embed too.

### 4c. WordPress connector plugin (separate repo: `leaguekeep-wp`, plugin slug `leaguekeep`)

**Free version (WordPress.org):**

- [ ] Settings page: league slug + optional API key, with a "Test connection" button.
- [ ] Gutenberg blocks:
  - Schedule
  - Standings
  - Results
  - Team list
  - Team page
  - Register button
- [ ] Shortcodes for the same widgets, so they work in Avada/Fusion Builder, Elementor and Classic Editor.
- [ ] Server-side fetch with transient caching (5–15 min, configurable). Show a graceful "data temporarily unavailable" state and never a PHP error.
- [ ] Theme-friendly, minimal CSS. Inherit colors from the league's branding via the API.
- [ ] A small "Powered by LeagueKeep" link (removable with Pro).
- [ ] Meet WordPress.org guidelines: GPL, escaping and sanitizing, nonces, i18n-ready, no tracking without opt-in, readme.txt with screenshots from the demo league.
- [ ] PHPCS with the WordPress Coding Standards plus Plugin Check passing in CI.

**Pro features (unlocked by an API key whose org has the PRO_AGENCY add-on):**

- [ ] White-label (no "Powered by").
- [ ] Advanced widgets: player stats leaders, upcoming-games ticker, field map.
- [ ] Multi-league support for agencies (several league keys on one WP site).
- [ ] The license check happens through our API. Keep the Pro code in the same plugin, gated by the server response, so there's no second zip to distribute.

### 4d. Switching tools

- [ ] **SportsPress importer:** CSV import of teams, players and past results from a SportsPress export.
- [ ] **Generic CSV importer:** players, teams and schedule.

### 4e. Before launch

- [ ] **Read-side RLS: try a per-page transaction, then re-measure.** Writes-only RLS is shipped
  (migration `20261025000000_rls_writes`, `docs/rls.md`). Restricting reads too cost pages
  +13–31 ms p95 on Vercel. Try running each page's data loading in one `leagueTransaction`,
  apply `prisma/rls/read-side.sql` to a throwaway Neon branch, and re-measure on a `leaguekeep`
  preview with the timing route described in `docs/rls.md`. Ship only if page p95 grows by less
  than 10 ms.

**Gate 3:** 10 paying leagues.

---

## 5. Phase 3: grow (months 7–12)

- [ ] **Referral program:** a referral code per org; when a referred league pays, the referrer gets one month free.
- [ ] **Agency partner dashboard:** one login manages several client leagues, with an optional rev share.
- [ ] **Remaining gap-audit features:** playoffs and cup brackets, a rainout tool with notifications, broadcast email to a division, team or the captains, suspensions measured in games, player transfers, extended stats.
- [ ] **Second sport:** only after this is confirmed with customers. Keep sport-specific rules (points, positions, stats) in org/season settings and templates, never in the schema.

**Gate 4:** recurring revenue covers costs, and then we decide whether to go full-time.

---

## 6. Ground rules for the dev session

- Don't break the NVASA org or the demo league. Every phase must keep the admin, captain, player and public flows working for both.
- Keep tenant isolation intact: every new model gets `organizationId`, uses the scoped client, and gets added to the isolation tests.
- No hardcoded prices, plan limits or brand names. Put them in config or the database.
- Make small commits per phase, keep the app runnable, and update the README.
- Leave anything that needs a product decision (pricing, the name, a sports-scope question) as a clearly marked TODO, and list it in the phase summary.

## 7. Future, not in scope now: AI features

**Don't build any of this yet.** Current work is Phases 0–2 above. Listed here only so today's data model doesn't block it later:

- **Smart schedule generator:** fields, referees, team blackout dates, one-click rainout reschedule.
  - *Keep in mind now:* store field availability, team blackout dates and referee availability as structured data, not free text.
- **Admin AI assistant:** plain-English commands over league data, such as "who hasn't paid" or "move Field 3 games and email captains."
  - *Keep in mind now:* keep admin actions as clean server functions that a tool-calling agent could call later.
- **Player help bot, auto match recaps, team balancing, player season cards.**
- **Video:** attach Veo, Trace or YouTube links to matches. No in-house computer vision.

## 8. Open questions (product owner: Safa)

- NVASA may not become a client. Which leagues are the first design-partner targets?
- Sports scope at launch: soccer only, or other adult rec sports in year one?
- Register leaguekeep.app and leaguekeep.io, and run a USPTO trademark search on "LeagueKeep".
- When does the NOVA sale close? That sets when Phase 1 starts.

Reference: full research and go-to-market plan → https://claude.ai/artifact/4dH592jnZZtSkHr7vSXzGg
