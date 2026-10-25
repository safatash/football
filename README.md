# LeagueKeep

LeagueKeep runs adult recreational soccer leagues: registration and payments, rosters and
captains, schedules, results and standings, referees and fields, and a public site for each
league. It's a multi-tenant SaaS: each league is an `Organization` (see "Multi-tenant
architecture" below). NVASA is one league on the platform and the source of the demo data.

The product name and root domain come from `APP_NAME` and `APP_ROOT_DOMAIN`; the code never
hardcodes them.

## Getting started

```bash
cp .env.example .env    # then fill it in (Neon branch or local Postgres; never production)
npm install
npx prisma migrate deploy && npm run db:seed
npm run dev             # http://nvasa.app.localhost:3000 (or http://localhost:3000/?org=nvasa)
```

Staging: the Vercel project `leaguekeep` builds every pushed branch as a protected preview against
the `rls-bench` Neon branch (`docs/rls.md`).

## Redesign (branch `redesign/ui`)

Mobile-first UI built from the NVASA design: pitch-green + lime tokens in `src/app/globals.css`,
shared components in `src/components/{ui,league,shell}`, and a live style sheet at `/design`
(the only page that uses example data). Everything else reads from and writes to the database.

### What's live

- **Accounts:** login, change password (`/portal/profile`), forgot password (`/login/forgot`),
  "Email me a login link" from Find my player info (`/login/link`). Links are single-use,
  expire in 30 minutes and are stored hashed in `verification_tokens`.
- **Season registration** (`/register/new`): real divisions, fees, age/gender rules (non-binary
  players can join coed divisions on the men's cutoff), teams, discount codes checked against
  `DiscountCode`. Submitted → Pending review (paid or free) → Approved / Denied. Signed-in players
  get a shorter returning-player path. No-team players land in placement; captain requests create
  `CaptainRequest` rows.
  - Open only while the league's switch is on (League profile) and inside the season's optional
    registration dates (inclusive league days; `src/lib/registration-window.ts`). The page and the
    API share the rule.
  - When the league requires the waiver, players must accept it, and `Registration.waiverAcceptedAt`
    records when. Every registration collects an emergency contact; players can also edit it on
    their profile.
  - A paid registration's Stripe Checkout expires after an hour. `checkout.session.expired`
    then cancels the unpaid registration and its pending captain request, so the player can start
    again.
- **Refunds made in Stripe** (`charge.refunded`) add a REFUND row to the league's ledger for the
  newly refunded amount; a retried event adds nothing. A fully refunded game pass is cancelled and
  leaves the match roster. See `src/lib/stripe-events.ts`.
- **Game passes** (`/register/game-pass`): pick a scheduled match and team, Stripe Checkout for the
  season's game pass fee; the webhook creates the pass (valid on match day, Eastern) and a
  match-only roster row. Expired passes never appear in roster pools.
- **Player portal:** dashboard with availability ("Can you make it?"), team, registrations,
  game passes, captain access requests.
- **Captain tools** (`/captain/[teamId]`), per-team access (captain of that team, or admin;
  teammates can read and print): roster roles, match roster (draft / finalize / reopen, server
  rules: max size, no suspended players, game passes only for their match, a goalkeeper), lineup
  from the finalized roster, match report (goals must match the score, red cards need a note,
  locked after submit), team update email. Print sheet: `/matches/[gameNumber]/print`.
- **League office** (`/admin`, with a season switcher; closed seasons are read-only on the server
  too): registrations (approve with team/captain, deny with reason and message, reopen),
  placement (assign, waitlist, request info), players (suspend/lift, make/remove captain, captain
  requests), teams, matches (officials, confirm reports, reminders), standings (confirmed reports
  only: 3/1/0, then goal difference, then goals for), divisions, and fees & eligibility (division
  fees and cutoffs, game pass fee, discount codes, eligible ZIPs, blocklist).
- **Email** for registration received / approved / denied, placement questions, captain
  decisions, game pass receipts, team updates, report reminders, login links and password resets.

### Public league pages (no login)

| Route | What it shows |
| --- | --- |
| `/standings` | Every division's table (3/1/0, then goal difference, then goals for) and top-3 goal leaders |
| `/results`, `/schedule` | Played games (newest first) and upcoming games; filter by season, division, team, or search |
| `/teams` | Every team by division with record and points |
| `/teams/[teamId]` | Team info and kits, scores & schedule with **Add to calendar** (`/teams/[teamId]/calendar.ics`), roster with season stats, standings, leaders |
| `/players/[playerId]` | Name, position, current team, team history with stats |
| `/divisions/[code]` | Teams, standings, leaders, paginated player stats, schedule |
| `/matches/[matchId]` | Game report: officials, score, each team's player lines (also accepts a game number) |

All of them use `?season=<slug>` (e.g. `spring-2026`) and default to the active season. They never
show emails, phones, addresses, dates of birth or ages; photos only appear for players who allow
it (`social`), and suspensions only show to signed-in users (loaded from `/api/public/viewer`, so
the cached pages stay public). Standings and player stats count matches the league office has
confirmed. `/sitemap.xml` lists the pages, and team and match pages include JSON-LD.

### Old site links

The old ColdFusion URLs answer with a **301** to the new pages. Ids are looked up by the season's
legacy datasource (`Season.legacyDatasource`) plus the legacy id; a missing or `0` season means the
active one. When nothing matches, the link lands on the list page with a short notice.

| Old URL | New page |
| --- | --- |
| `/results.cfm?season=` | `/results?season=` |
| `/team.cfm?id=&season=` | `/teams/[teamId]` |
| `/player.cfm?id=&season=` | `/players/[playerId]` |
| `/divisions.cfm?season=` | `/standings?season=` |
| `/division.cfm?id=` | `/divisions/[code]` |
| `/gamereport/index.cfm?gid=` | `/matches/[matchId]` |
| `/export.cfm?id=` | `/teams/[teamId]/calendar.ics` |
| `/register.cfm` | `/register` |
| `/login.cfm`, `/forgotNew.cfm` | `/login` |
| `/?home=1` | `/` |

### Old-site data

There's no import from the old site's database: we don't have access to it, and the new site runs
on its own Postgres with seed data. If a `.sql` or CSV export of players and seasons turns up, an
importer will read that file. `src/lib/legacy-import.ts` already holds the source-agnostic mapping
(legacy ids, kit colors, kickoff times, cards, upserts) for it; nothing runs it today.

### Environment

See `.env.example`. Beyond the database, NextAuth and Stripe keys:

| Variable | What it does |
| --- | --- |
| `APP_ROOT_DOMAIN` | Leagues live at `<slug>.<APP_ROOT_DOMAIN>` (default `leaguekeep.app`; locally set `app.localhost`, so `nvasa.app.localhost:3000`). |
| `APP_ROOT_URL` | Scheme and port of the root domain for links (default `https://<APP_ROOT_DOMAIN>`, or `http://<APP_ROOT_DOMAIN>:3000` for a `*.localhost` root). A league's links use its custom domain or `<slug>.` + this. |
| `AUTH_TRUST_HOST` | `true` so sign-in redirects stay on the league's host (set automatically on Vercel). |
| `APP_NAME` | Product name for "{League} via {APP_NAME}" emails (default `LeagueKeep`). |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob, for league logo uploads. |
| `ORG_SLUG`, `ALLOW_ORG_FALLBACK` | Local work on plain `localhost`: the league to show (or `?org=<slug>`). Ignored in production unless `ALLOW_ORG_FALLBACK=true`. |
| `CRON_SECRET` | Required by `/api/cron/*` (`Authorization: Bearer …`). Vercel Cron sends it. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Outgoing mail. Production sends when set. |
| `MAIL_DELIVER`, `MAIL_TEST_RECIPIENTS` | Outside production, mail is only logged to the server console. Set `MAIL_DELIVER=true` to really send, and then only to `example.com` / `.test` addresses or the ones listed in `MAIL_TEST_RECIPIENTS`. |
| `STRIPE_WEBHOOK_SECRET` | Verifies `/api/stripe/webhook`: `checkout.session.completed` (registration and game pass checkouts, by `metadata.type`), `checkout.session.expired` and `charge.refunded`. Subscribe the endpoint to all three. |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | Verifies `/api/stripe/connect-webhook` (Connect events from leagues' accounts: `account.updated`, `account.application.deauthorized`). |
| `STRIPE_FEE_BPS`, `STRIPE_FEE_CENTS` | Stripe's card processing price, passed on to the league in each application fee (defaults 290 = 2.9% and 30¢). Set them to the platform's actual Stripe pricing. |
| `STRIPE_ALLOW_LIVE` | League payments and onboarding refuse a live key (`sk_live_…`) unless this is `true`. |
| `NVASA_NOW` | Optional. Pretend it's another moment, e.g. `2026-05-16T12:00:00-04:00` to see the seeded match week. Leave unset in production. |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Optional. Sentry error monitoring for the server / browser; unset = off. No personal data is sent (`src/lib/monitoring.ts`). |
| `SENTRY_TRACES_SAMPLE_RATE` | Optional. Performance tracing sample rate, 0 to 1 (default 0). |

### Database, migrations and seed

Migrations live in `prisma/migrations`: `0_init` (the original schema), `admin_role`,
`league_core` and `public_pages`. A database that was created earlier with `db push` already has the `0_init` tables,
so mark it applied once, then deploy (nothing is dropped; `league_core` moves the old division
fields and legacy team picks into the new columns, and stops if it finds data it can't map):

```bash
npx prisma migrate resolve --applied 0_init
npx prisma migrate deploy
npm run db:seed
```

A fresh database only needs `npx prisma migrate deploy && npm run db:seed`. The seed is safe to
re-run: it loads Spring 2026 (5 divisions, 13 teams, games #101–#210 with officials and reports,
rosters with jerseys, availability, game passes, the registration and placement queues,
suspensions, discount codes, extra ZIPs and the blocklist) and removes the old placeholder
divisions when nothing uses them.

| Account | Password | Sees |
| --- | --- | --- |
| `safatash@gmail.com` | `Admin123!` | NVASA league office (`/admin`, owner); platform operator; no player profile |
| `maya.johnson@example.com` | `MayaJohnson26` | Captain of Fairfax United, player on Bloodline |
| Any other seeded player, e.g. `hannah.cole@example.com` | `NvasaPlayer26` | Player portal |
| `demo.office@example.com` | `DemoOffice26` | Demo League office (`demo.app.localhost:3000/admin`) |

The seed also creates the **Demo League** (`prisma/seed-demo-league.ts`, slug `demo`): one season,
one division, "Fairfax United" and "Alexandria FC" (the same names as NVASA's), one match, a paid
registration, a park and a referee. Maya is a member of both leagues with a separate player
profile in each.

The seeded matches are in May 2026; set `NVASA_NOW=2026-05-16T12:00:00-04:00` to see Game #204 as
"tomorrow".

### Cron

`vercel.json` schedules two jobs (daily, so they fit the Hobby plan):

- `/api/cron/expire-game-passes` (05:15 UTC): marks passes past their window `EXPIRED` and closes
  their game-pass roster rows. Pages already ignore expired passes before this runs.
- `/api/cron/daily` (05:30 UTC): marks reports still missing 48 hours after kickoff `OVERDUE`, and
  returns players whose suspension ended to Active.

Both run once per league in service (`TRIAL`, `ACTIVE`, `PAST_DUE`) and return results by league slug.

### Multi-tenant architecture (branch `saas/multitenant`)

The app hosts many leagues ("organizations"). NVASA is one of them (`org_nvasa`).

**Data ownership.** `Organization` holds the league (slug, status, plan, custom domain), with
`OrganizationSettings` and `OrganizationMember` (role `OWNER` / `ADMIN` / `STAFF` / `PLAYER`).
Every league-owned table has a required `organizationId` with no database default. Unique keys are
per league (season names, team codes, discount codes, registration numbers…). Child rows point at
their parents with composite foreign keys (`[parentId, organizationId]`), so the database rejects a
row in one league that references another league's row.

A `User` is a login shared across leagues. Each league has its own `Player` profile for that user
(`players` is filtered by `organizationId`) and its own membership. League roles come from
`OrganizationMember`; `User.isPlatformAdmin` marks the SaaS operator. There is no global admin role.

**Finding the league.** `src/proxy.ts` reads the host:

| Host | League |
| --- | --- |
| `<slug>.<APP_ROOT_DOMAIN>` | by slug |
| any other host | by `Organization.customDomain` |
| `localhost` (development) | `?org=<slug>` (kept in a cookie), else `ORG_SLUG` |

Unknown host → "League not found" (404). `SUSPENDED` / `CANCELLED` → "This league is unavailable"
(503), except `/login`, `/api/auth/*` and `/admin`, so the office can still sign in. The proxy
removes any client-sent `x-org-id` and sets its own. `/api/stripe/webhook` and `/api/cron/*` are
platform routes with no league host.

**Enforced isolation.** App code reads and writes through `db` / `getDb()` from `@/lib/db`
(`src/platform/db.ts`): a Prisma extension that adds `organizationId` to every `where` (find,
count, aggregate, groupBy, update, delete, upsert) and sets it on every create, and refuses writes
that name another league. The current league comes from `runWithOrg()` (webhooks, crons, seed,
tests) or the proxy's header. Raw SQL isn't covered, so each `$queryRaw` filters on
`"organizationId"` itself. The raw client (`@/platform/prisma`) is only allowed in `src/platform/`,
scripts, the seed and tests.

- Authorization: `requireOrgRole([...])` (`src/lib/access.ts`) checks the membership in the current
  league; the admin guard is `requireOrgRole(["OWNER", "ADMIN"])`. Captain rights stay per team.
- Sign-in is per league: NextAuth cookies are per host, and you need a membership in that league
  (platform operators can sign in anywhere).
- Stripe Checkout sessions carry `metadata.organizationId`; the webhook runs as that league
  (older sessions are matched through their registration or match).
- Audit log rows belong to the league. There are no file uploads or data-cache tags yet; when
  they arrive, prefix keys and tags with the organization id.

Guard tests (run in CI, `.github/workflows/ci.yml`):

- `tests/integration/isolation.test.ts`: working as the Demo League, NVASA's players, teams,
  matches, payments, registrations, referees, parks and fields can't be read, listed, updated or
  deleted, through the client, the page queries or server actions with guessed ids; NVASA's admin
  has no office access there; an NVASA-only player can't sign in there; and a checksum of every
  NVASA row is unchanged afterwards.
- `tests/raw-client.test.ts`: no raw client outside `src/platform/`, and every raw SQL query
  filters by `organizationId`.

**Row-level security (Phase 2b, writes-only).** Migration `20261025000000_rls_writes` puts
Postgres policies on every league table: reads are open at the database level, and writes must
match the league in `app.org_id`. With `DB_RLS=on`, the scoped client connects as a non-owner
role (`DATABASE_APP_URL`, created by `npm run db:app-role`) and sets `app.org_id` per transaction
(`SET LOCAL`, so it's safe behind Neon's pgbouncer pooler). Each server action runs in one
league transaction. Platform code keeps the owner connection. See `docs/rls.md` for setup,
latency numbers, and why reads aren't restricted yet.

**League branding (Phase 3).** Nothing in the app names a league. Names, logo, colors, contact
emails, social links, timezone and waiver come from the organization (`src/lib/branding.ts`:
`getBrand()` on the server, `useBrand()` in client components, set once by the root layout).

- Colors: the main and accent colors replace the `--pitch` and `--lime` theme variables
  (`src/lib/theme.ts`; only `#RRGGBB` values are accepted, and light main colors are darkened until
  white text on them is readable). Without colors the app keeps its green.
- Emails go out as `"{League} via {APP_NAME}" <address from SMTP_FROM>` with reply-to set to the
  league's contact email, in the league's colors.
- Links in emails, Stripe and structured data use the league's own address (`leagueOrigin`:
  its custom domain, else `<slug>.` + `APP_ROOT_URL`). Set `AUTH_TRUST_HOST=true` so sign-in stays
  on the league's host (Vercel does this for you).
- Old ColdFusion links (`*.cfm`) only answer for leagues with `legacyRedirects` (NVASA); other
  leagues get 404.
- Admin › Settings › **League profile**: name, logo (Vercel Blob under `orgs/<orgId>/`, PNG/JPEG/
  WebP up to 512 KB; without `BLOB_READ_WRITE_TOKEN` admins paste a logo link), colors, contacts,
  social links, timezone and waiver text (shown in the registration wizard).
- Admin › Settings › **Staff**: invite by email as Admin or Staff, change roles, remove. Staff can
  open the league office read-only (every write requires Owner or Admin). The owner and your own
  role can't be changed there.
- `tests/no-hardcoded-league.test.ts` fails if "NVASA" or its addresses come back into `src/`.

The timezone is saved per league, but dates still display in Eastern time: the formatters in
`src/lib/format.ts` use one fixed zone, and making them per-league is a separate change.

**Platform layer (Phase 4).** The root domain (`APP_ROOT_DOMAIN`, also `admin.<root>`) is the
platform, not a league: it serves `/signup`, `/platform` and sign-in, and nothing else. League
addresses never serve `/platform` or `/signup`. Slugs such as `admin`, `www`, `api` and `platform`
are reserved.

- `/platform` (only `isPlatformAdmin`; everyone else gets a 404): every league with status, plan,
  players, created date and last activity; a league page to change status or plan, extend the
  trial, see usage, and **Impersonate admin**; and **New league** for manual onboarding (the owner
  is emailed a link to set a password).
- Impersonation makes the operator an ADMIN of that league for up to 60 minutes. A red banner
  shows the whole time, with **Stop impersonating**; start and stop, and everything done meanwhile,
  are in the league's audit log under the operator's email (`src/platform/organizations.ts`,
  `Impersonation` model).
- `/signup`: league name and address (checked as you type), email and password (or an existing
  login with its password). It creates the league in `TRIAL` with `trialEndsAt` 30 days out, its
  settings and an OWNER membership, then signs the owner in on the league's own address and opens
  **Admin › Setup checklist** (profile, first season, divisions and fees, fields, staff, payments:
  coming in Phase 5). A hidden honeypot field and a per-IP limit slow down scripted signups; there
  is no email verification or CAPTCHA yet.
- A league's first season can **start from a template**: "Adult rec league" (five adult divisions
  with sample fees and age rules, positions, shirt sizes) or "Blank" (`src/lib/season-templates.ts`).
- Sessions are per host, so moving between the platform and a league uses a short-lived one-time
  sign-in link (`/login/link?token=…&next=…`).

To try it locally: open `http://app.localhost:3000/signup`, or sign in at
`http://app.localhost:3000/login?next=/platform` as `safatash@gmail.com` (seeded operator).

Planned: Postgres row-level security as a second layer (after measuring its cost), and per-league
payments with Stripe Connect plus platform billing with Stripe Billing. The design is in
[docs/payments-architecture.md](docs/payments-architecture.md) (Phase 5; not built).

### Scheduling and standings

- **Field availability** (field page): weekly windows when a field can host matches. **Team
  blackout dates** (team page): days a team can't play. Both are stored as structured rows
  (`field_availability`, `team_blackouts`), ready for a smarter scheduler later.
- **Generate schedule** (Matches › Generate schedule; `src/lib/round-robin.ts`): a single or
  double round robin for the chosen divisions, on the fields' weekly times. Kickoffs are 2 hours
  apart; nothing is scheduled in the past, on blackout dates, or in slots existing matches use;
  no team plays twice a day. Preview first; pairings that don't fit are listed. Creating
  recomputes the plan on the server.
- **Import CSV** (Matches › Import CSV; `src/lib/schedule-csv.ts`): a header row with date, time,
  home, away and optionally field, division and game number. Every line is checked first
  (teams, fields, divisions, game numbers), with clashes shown as warnings; nothing is imported
  until every line is valid.
- **Forfeits** (match page): the other team wins `OrganizationSettings.forfeitGoals`–0 (default
  3), and the result counts in the standings. Editing the match result replaces the forfeit.
- **Point adjustments** (Standings): deductions or bonuses with a reason. Tables show adjusted
  points with a note; wins, draws and goals stay as played.

### League payments (Stripe Connect)

Each league connects its own Stripe Express account (Settings › Online payments, also a setup
checklist step). Registration, balance-link and game-pass checkouts go through
`createLeagueCheckout` (`src/lib/league-checkout.ts`). That makes a destination charge to the
league's account. The application fee is the platform fee (`Organization.platformFeeBps`,
default 1%, 0 for comped leagues, set on `/platform`) plus Stripe's processing fee
(2.9% + 30¢ by default), so the league pays card processing. Leagues that existed before Connect
(`legacyPlatformPayments`, e.g. NVASA) keep using the platform account until they connect.
A league that isn't connected takes registrations "pay later". Connect events go to
`/api/stripe/connect-webhook`. Test mode only: a live key is refused unless `STRIPE_ALLOW_LIVE=true`.
Details and open decisions: `docs/payments-architecture.md`.

### Security and privacy

- **Rate limits** (`src/platform/rate-limit.ts`): sign-in, login-link and password-reset requests,
  reset confirmations, player lookups, registration and discount checks are limited per IP
  address, and per email where there is one. Counters are rows in `rate_limits`, so they hold
  across serverless instances; the daily cron prunes them. Over the limit: HTTP 429 with
  `Retry-After` (sign-in shows "Too many sign-in attempts").
- **Bot protection:** the recovery, lookup and registration forms carry a hidden honeypot field
  (`useHoneypot`). Requests that fill it get the normal answer, and nothing is sent or created.
- **Error monitoring:** Sentry through `src/instrumentation.ts` and `src/instrumentation-client.ts`,
  active only when a DSN is set. It's configured to send no user info, cookies, headers, query
  strings or request bodies.
- **Privacy policy:** `/privacy`, a placeholder marked TODO until the final text is written.
  It's linked from the footers and the registration review.
- **Account deletion:** players delete their account from their profile
  (`src/lib/actions/account.ts`). The league's profile is anonymized ("Deleted player"; the date
  of birth becomes 1900-01-01), they leave their teams and their membership ends. The league
  keeps its registrations, payments and ledger. The shared login (email, password, sessions) is
  erased only if no other league still uses it. League office members can't delete themselves
  this way.

### Checks

```bash
npx tsc --noEmit && npx eslint . && npm test && npm run build
```

`npm test` runs the unit tests (eligibility, fees and discounts, match roster and report rules,
game pass windows, standings, mail delivery, and 401/403 checks for captain and admin writes).
The integration tests in `tests/integration` run the same server actions and API routes against a
seeded **local** database and refuse any other host:

```bash
TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/nvasa_test" npm test
```
