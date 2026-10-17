# NVASA — finish the backend behind the redesign

You're working in the NVASA league app (Next.js 16 App Router, React 19, Tailwind v4, Prisma 6 + Neon Postgres, NextAuth v4 credentials, Stripe). Branch: `redesign/ui`. Stay on it and commit after each phase.

## Read first
- `AGENTS.md`: this Next.js has breaking changes. Check `node_modules/next/dist/docs/` before using an API. `params`/`searchParams`/`cookies()`/`headers()` are async; middleware is now `proxy`.
- `README.md` (Redesign section), `prisma/schema.prisma`, `src/lib/league-data.ts` (sample data + rules), `src/lib/session.ts`, `src/lib/admin.ts`.
- The UI is finished. Keep its look, components (`src/components/{ui,league,shell}`), tokens (`src/app/globals.css`) and microcopy. Your job is to replace sample data and screen-only actions with real data and persistence. Don't restyle.

## Goal
Every screen except `/design` reads from the database, and every button that currently only shows a toast or changes local state persists its change with proper authorization. When done, `src/lib/league-data.ts` keeps only pure helpers (formatting, `ageOn`, constants). It holds no sample records, and no page imports sample records.

## Phase 0 — Admin account
- League-office admin is **safatash@gmail.com**. `src/lib/admin.ts` already defaults `ADMIN_EMAILS` to it and the seed creates it (password `Admin123!`).
- Add a real role: `enum Role { PLAYER ADMIN }` and `User.role Role @default(PLAYER)`. Treat a user as admin if `role = ADMIN` **or** their email is in `ADMIN_EMAILS`. The seed sets `role: ADMIN` for safatash@gmail.com.
- Add `npm run admin:grant -- <email>` (a tsx script) to promote a user.
- Add "Change password" to `/portal/profile` (current + new, same strength rules as registration). Admins without a player profile must still be able to sign in and reach `/admin`.

## Phase 1 — Schema (one migration: `prisma migrate dev --name league-core`)
Add or extend these models, with indexes and sensible `onDelete` rules:
- **Division:** `code` (unique per season), `level`, `genderRule` (`WOMEN | MEN | COED`), `maleBornOnOrBefore`, `femaleBornOnOrBefore`, `minAge`. Replace the confusing `*BirthDateAfter` fields; migrate their data.
- **Gender:** add `NON_BINARY`. Eligibility rule: coed divisions only, using the stricter (male) cutoff.
- **Registration:** `divisionId`, `preferredTeamId`, `backupTeamId`, `background` (`NEW | RETURNING`), `level`, `captainNote`, `discountCodeId`, `amountBeforeDiscount`, `placementState` (`NONE | NEW | INFO_REQUESTED | WAITLISTED | ASSIGNED`). Add a `SUBMITTED` value so statuses read Submitted → Pending review → Approved / Denied. Also `deniedReason`, `deniedMessage`.
- **Team:** `code`, `color`, `shortName`, `homeField`.
- **TeamRoster:** `jerseyNumber`.
- **Match:** `gameNumber` (unique per season), `ref1`, `ref2`, `ref3` (nullable names or a `Referee` model), `reportStatus` (`NOT_STARTED | DRAFT | SUBMITTED | CONFIRMED | OVERDUE`).
- **New models:**
  - `MatchAvailability` (match, roster member, `AVAILABLE | UNAVAILABLE | MAYBE`, note)
  - `MatchRoster` (match + team unique, `DRAFT | FINALIZED`, finalizedAt/by)
  - `MatchRosterEntry` (matchRoster, teamRoster member, `lineupSlot?`, `formation` on MatchRoster)
  - `MatchReport` (match + team, homeScore, awayScore, redCardNote, status, submittedBy/at, confirmedBy/at)
  - `PlayerMatchStat` (report, player, goals, assists, yellow, red)
  - `CaptainRequest` (player, team, note, `PENDING | APPROVED | DENIED`, decidedBy/at)
  - `Suspension` (player, reason, startsAt, endsAt, createdBy). Player status SUSPENDED is derived from it, or kept in sync with it.
  - `DiscountCode` (code unique, kind `BOARD | PROMO | TEAM_PAID`, type `PERCENT | AMOUNT`, value, maxUses, uses, active, seasonId, teamId?)
  - `LeagueSettings` (seasonId, gamePassFee default 15, maxMatchRoster default 18, fairfaxCountyAllowed)
- Keep the existing `Blocklist` and `AllowedZipCode` tables.
- Update `prisma/seed.ts` so it creates everything that's currently in `league-data.ts`: all divisions with real rules and fees (Women Premier $95, Men D1 $105, D3 Coed $55 born ≤ 12/31/2008, Masters Coed $45 men ≤ 12/31/1991 / women ≤ 12/31/1996, Combination Coed $60, game pass $15), the 13 teams, matches with game numbers and officials, the Fairfax United roster with jerseys and availability, Jordan Lee's game pass for Game #204, the registrations queue, placements, players, suspensions and discount codes. It must be idempotent.
- Remove the old placeholder divisions (Men's Open, Women's Open, Coed Recreational, Men's Over 30) when they have no teams.

## Phase 2 — Read paths
Replace every sample-data import with Prisma queries. Put shared queries in `src/lib/queries/*.ts`. Pages:
- **Admin:** `/admin` (counts, queue preview, this Sunday, needs attention, placement, team snapshot), registrations list/detail (division and preferred team from the new columns), `placements` + `[id]`, `players` (`?q`, `?status`), `players/[id]` (route by player id), `teams` + `[id]` (by team id or code), `matches` + `[id]` (by game number), `standings` (computed from CONFIRMED reports only: 3 pts per win, 1 per draw; ties broken by goal difference, then goals for), `divisions/[code]`, `settings`.
- **Captain** (see Phase 4 for auth): overview, roster, match roster, lineup, report.
- **Portal:** use jersey numbers and game numbers. `/portal/team`: real roster.
- **Print:** `/matches/[gameNumber]/print` with officials, jerseys, finalized roster, and game-pass rows marked GP.
- **Season switcher** (`?season=`): filter every admin query by season, and keep archived seasons read-only on the server too.

## Phase 3 — Season registration (finish it)
- `/api/register/new`:
  - Store the new Registration fields, `divisionId` and team ids. Use the real DB divisions/teams in the wizard: the server page passes them to `registration-wizard.tsx`.
  - Eligibility is checked server-side from Division columns.
  - Validate discount codes against `DiscountCode` (active, season, uses < maxUses, TEAM_PAID only for its team) and increment `uses` in the Stripe webhook / on free registrations.
  - Allow NON_BINARY.
  - New registrations start as SUBMITTED. They move to PENDING review when payment is PAID (webhook) or immediately when the total is $0.
- Returning players (logged in) get a shorter path that creates a RETURNING_PLAYER or ADDITIONAL_TEAM registration on their existing player profile.
- A new player with no preferred team gets `placementState = NEW` and shows up in the placement queue.
- A captain request creates a `CaptainRequest` (PENDING).

## Phase 4 — Captain tools, with per-team authorization
- Permissions are **per team**. Write `requireCaptain(teamId)`: the user has an active `TeamRoster` with `isCaptain` on that team, or is admin.
- Move captain routes under a team: `/captain/[teamId]`, `/captain/[teamId]/team`, `/captain/[teamId]/lineup`, `/captain/[teamId]/matches/[gameNumber]/roster|report`. Redirect `/captain` to the user's first captained team, or to `/portal` with a notice if they captain none.
- The layout shows a team switcher when the user captains several teams, and the `TeamHeader` role tag reflects the real access.
- Server actions (zod-validated, authorized, `revalidatePath`):
  - set availability (players for themselves; captains for anyone on their team)
  - edit lineup role
  - send team update (email to roster + active game-pass players for the next match)
  - match roster save draft / finalize / reopen. Enforce server-side: ≤ `maxMatchRoster`, no suspended players, game-pass players only for the match their pass covers, at least one GK. Unavailable players are allowed but return warnings.
  - lineup save (slots must be finalized-roster members)
  - match report save / submit. Enforce server-side: the sum of player goals equals the team score; a red-card note is required if there's any red; locked after submit.
- Players (non-captains) can only read and print. Any write from them must return 403.

## Phase 5 — Game pass
- `/api/game-pass/checkout`: requires a signed-in player. A brand-new player gets a minimal profile created first (name, email, DOB, phone + password, or a magic link).
  - Check: match is SCHEDULED and in the future; age is eligible for the match's division; email not blocklisted; no existing pass for that match.
  - Create a Stripe Checkout for `gamePassFee` with metadata `{ type: 'game_pass', matchId, playerId }`.
- Webhook branches on `metadata.type`:
  - Game pass: create Payment (GAME_PASS), GamePass ACTIVE (validFrom = match day 00:00 America/New_York, validUntil = match end or 23:59 that day), and a `TeamRoster` row with `membershipType: GAME_PASS` and `matchId`. The team is chosen at purchase, or assigned by the captain/admin.
  - Registration: the existing branch.
  - Keep it idempotent.
- Expiry: a pass is EXPIRED after `validUntil`.
  - Enforce on read: queries never return expired passes in roster pools.
  - Add `/api/cron/expire-game-passes`, protected by `CRON_SECRET`, that marks passes EXPIRED and sets `leftAt` on their GAME_PASS roster rows. Document a Vercel cron entry.
  - A pass never creates SEASONAL membership.
- Wire `/register/game-pass` to it. The confirmation page reads the real pass.

## Phase 6 — Admin actions (persist all of them)
- Approve/deny (exists; also store the deny reason and message).
- Approve or deny a captain request (approving sets `isCaptain` on that team only).
- Make or remove captain on a membership.
- Placement: assign division + team (creates the roster row), waitlist, request info (sends an email).
- Suspend (reason, end date) / lift suspension.
- Assign officials.
- Confirm a match report: standings update, and an Overdue status for SUBMITTED-missing reports 48h after the match.
- Settings save: division fees, age cutoffs, game pass fee, discount codes CRUD, allowed ZIPs add/remove, blocklist add/remove.
- Every admin API/action re-checks admin server-side, and archived seasons are read-only.

## Phase 7 — Email (SMTP vars already exist in `.env`)
- Add `nodemailer`. Write `src/lib/mail.ts` with plain, branded HTML + text templates for: registration received, approved (team + captain status), denied (reason/message), placement info request, captain request decided, game pass receipt, team update, password reset/login link.
- Retrieve-info "Email me a login link": signed, single-use, 30-minute token using the existing `VerificationToken` table, plus a `/login/link` route that signs the user in.
- "Forgot password": reset flow using the same token table.
- If SMTP isn't configured, log the email in development instead of failing.

## Phase 8 — Quality bar
- Add Vitest unit tests for: eligibility (all divisions, both genders, non-binary, age 18 on opening day), fee + discount calculation, match roster rules, report validation, game pass validity windows, standings computation.
- Add route-level tests that a non-admin gets 403 from admin APIs and a non-captain gets 403 from captain actions.
- `npx tsc --noEmit`, `npx eslint .`, `npm test` and `npm run build` all pass.
- Add `loading.tsx` and `error.tsx` for portal, captain and admin in the existing style. Use `notFound()` for unknown ids.
- No sample-data imports outside `/design` (grep to prove it). No "TODO", "mock", "demo" or "prototype" in UI copy.
- Update the README "Redesign" section: what's live, env vars (`ADMIN_EMAILS`, `CRON_SECRET`, SMTP, Stripe), seed accounts, migrations, cron.

## Working style
- Do the phases in order. After each one: run the checks, commit with a clear message, and give me a short summary of what changed and anything you had to decide.
- Ask me before:
  - dropping data
  - changing Stripe products/prices in the dashboard
  - anything that sends real email to non-test addresses
- Never commit `.env`. Don't print secrets.
