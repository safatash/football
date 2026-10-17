This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.


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

### Environment

See `.env.example`. Beyond the database, NextAuth and Stripe keys:

| Variable | What it does |
| --- | --- |
| `ADMIN_EMAILS` | Comma-separated league-office emails (defaults to `safatash@gmail.com`). Users with `role = ADMIN` are admins too: `npm run admin:grant -- someone@example.com`. |
| `CRON_SECRET` | Required by `/api/cron/*` (`Authorization: Bearer …`). Vercel Cron sends it. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Outgoing mail. Production sends when set. |
| `MAIL_DELIVER`, `MAIL_TEST_RECIPIENTS` | Outside production, mail is only logged to the server console. Set `MAIL_DELIVER=true` to really send, and then only to `example.com` / `.test` addresses or the ones listed in `MAIL_TEST_RECIPIENTS`. |
| `STRIPE_WEBHOOK_SECRET` | Verifies `/api/stripe/webhook` (registration and game pass checkouts, by `metadata.type`). |
| `NVASA_NOW` | Optional. Pretend it's another moment, e.g. `2026-05-16T12:00:00-04:00` to see the seeded match week. Leave unset in production. |

### Database, migrations and seed

Migrations live in `prisma/migrations`: `0_init` (the original schema), `admin_role` and
`league_core`. A database that was created earlier with `db push` already has the `0_init` tables,
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
| `safatash@gmail.com` | `Admin123!` | League office (`/admin`); no player profile |
| `maya.johnson@example.com` | `MayaJohnson26` | Captain of Fairfax United, player on Bloodline |
| Any other seeded player, e.g. `hannah.cole@example.com` | `NvasaPlayer26` | Player portal |

The seeded matches are in May 2026; set `NVASA_NOW=2026-05-16T12:00:00-04:00` to see Game #204 as
"tomorrow".

### Cron

`vercel.json` schedules two jobs (daily, so they fit the Hobby plan):

- `/api/cron/expire-game-passes` (05:15 UTC): marks passes past their window `EXPIRED` and closes
  their game-pass roster rows. Pages already ignore expired passes before this runs.
- `/api/cron/daily` (05:30 UTC): marks reports still missing 48 hours after kickoff `OVERDUE`, and
  returns players whose suspension ended to Active.

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
