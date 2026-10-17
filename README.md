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
shared components in `src/components/{ui,league,shell}`, and a live style sheet at `/design`.

**After pulling:** `npm install` (adds self-hosted fonts), then `npm run db:seed` to load the
Spring 2026 divisions, teams, matches and a demo player.

| Account | Password | Sees |
| --- | --- | --- |
| `maya.johnson@example.com` | `MayaJohnson26` | Player portal (captain of Fairfax United, player on Bloodline, game passes) |
| `safatash@gmail.com` | `Admin123!` | League office (`/admin`) |

League-office access comes from `ADMIN_EMAILS` (comma-separated, defaults to `safatash@gmail.com`).

**Live on the database:** login, retrieve player info, season registration → Stripe checkout
(fee from the division, discount codes, free registrations skip Stripe), Stripe webhook,
player dashboard / registrations / profile (saves), admin registration review with approve / deny.

**Running on sample data (`src/lib/league-data.ts`) until the schema has the tables:** captain tools
(match roster, lineup, match report), game-pass purchase, placement queue, players/teams/matches/
standings/divisions in admin, fees & eligibility settings. Their actions update the screen only.
