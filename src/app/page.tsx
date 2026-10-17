import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { Badge, GamePassTag } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { BodyCell, BodyRow, DataTable, HeadCell, TableBody, TableHead, TableWrap } from "@/components/ui/table";
import { Logo, MatchMeta, VsRow, vsFor } from "@/components/league";
import { DIVISIONS, GAME_PASS_FEE, MATCHES, TEAMS, division, money } from "@/lib/league-data";

export const metadata: Metadata = {
  title: { absolute: "NVASA · Sunday soccer for adults" },
};

const SUNDAY = "Sun, May 17";

function PitchLines() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 size-full opacity-[.13]"
      viewBox="0 0 1200 600"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <g fill="none" stroke="#fff" strokeWidth="3">
        <rect x="40" y="40" width="1120" height="520" />
        <path d="M600 40v520" />
        <circle cx="600" cy="300" r="92" />
        <rect x="40" y="170" width="150" height="260" />
        <rect x="1010" y="170" width="150" height="260" />
        <rect x="40" y="235" width="55" height="130" />
        <rect x="1105" y="235" width="55" height="130" />
        <path d="M190 240a75 75 0 010 120M1010 240a75 75 0 000 120" />
      </g>
    </svg>
  );
}

const section = "mx-auto w-full max-w-[1180px] px-4";
const feeMin = Math.min(...DIVISIONS.map((d) => d.fee));
const feeMax = Math.max(...DIVISIONS.map((d) => d.fee));

export default function LandingPage() {
  const sunday = MATCHES.filter((m) => m.date === SUNDAY);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero */}
      <div className="relative overflow-hidden bg-pitch text-white">
        <PitchLines />
        <nav aria-label="NVASA" className={`relative z-[2] flex items-center gap-3 py-3.5 sm:gap-4 ${section}`}>
          <Logo tone="light" />
          <span className="flex-1" />
          <Link href="#fees" className="hidden text-[13.5px] font-bold text-white sm:inline">
            Divisions & fees
          </Link>
          <Link
            href="/login"
            className="inline-flex min-h-9 items-center rounded-full border border-white/30 bg-white/10 px-3.5 text-[13.5px] font-bold text-white hover:bg-white/20"
          >
            Log in
          </Link>
        </nav>

        <div className={`relative z-[1] grid items-center gap-10 pt-9 pb-10 lg:grid-cols-[1.25fr_1fr] lg:pt-14 lg:pb-16 ${section}`}>
          <div className="flex flex-col gap-5">
            <span className="eyebrow !text-lime">Spring 2026 · Games every Sunday through June 28</span>
            <h1 className="text-[clamp(46px,7vw,88px)] leading-[.9] uppercase">
              Sunday soccer for adults. <em className="not-italic text-lime">Properly run.</em>
            </h1>
            <p className="max-w-[52ch] text-lg text-white/85">
              Recreational and competitive leagues for players 18 and up across Fairfax, Arlington and Alexandria. Real referees, real
              standings, and a roster that shows up.
            </p>
            <div className="flex flex-wrap gap-[18px] text-sm font-semibold text-white/85">
              <span className="inline-flex items-center gap-1.5">
                <Icon name="shield" className="size-[18px]" />
                {DIVISIONS.length} divisions
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Icon name="users" className="size-[18px]" />
                {TEAMS.length} teams
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Icon name="pin" className="size-[18px]" />9 fields
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 rounded-[20px] bg-surface p-[22px] text-fg shadow-2xl">
              <div className="flex items-center justify-between gap-2">
                <span className="eyebrow">Join for the season</span>
                <Badge tone="ok">Open until May 31</Badge>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-[44px] leading-none font-extrabold">
                  {money(feeMin)}–{money(feeMax)}
                </span>
                <span className="text-sm text-muted">by division</span>
              </div>
              <p className="text-sm text-muted">Every match, a spot on a team roster, a league shirt and standings that count.</p>
              <ButtonLink href="/register/new" variant="accent" block>
                Register for the season <Icon name="right" className="size-[18px]" />
              </ButtonLink>
            </div>

            <div className="flex flex-col gap-3 rounded-[20px] bg-surface p-[22px] text-fg shadow-2xl">
              <div className="flex items-center justify-between gap-2">
                <span className="eyebrow">Play one match</span>
                <GamePassTag>Game pass</GamePassTag>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-[44px] leading-none font-extrabold">{money(GAME_PASS_FEE)}</span>
                <span className="text-sm text-muted">one game, one day</span>
              </div>
              <p className="text-sm text-muted">
                Pick a match, pay, and play. Good for that game day only. It doesn’t add you to a team.
              </p>
              <ButtonLink href="/register/game-pass" variant="primary" block>
                Buy a game pass {money(GAME_PASS_FEE)} <Icon name="right" className="size-[18px]" />
              </ButtonLink>
            </div>

            <p className="text-center text-sm text-white/85">
              Already registered?{" "}
              <Link href="/login" className="font-bold text-lime underline underline-offset-4">
                Log in
              </Link>
            </p>
          </div>
        </div>
      </div>

      <main className="flex flex-1 flex-col">
        {/* Divisions & fees */}
        <section id="fees" className={`flex scroll-mt-4 flex-col gap-5 py-12 ${section}`}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="eyebrow">Spring 2026</span>
              <h2 className="text-[40px]">Divisions & fees</h2>
            </div>
            <p className="max-w-[48ch] text-muted">
              Your date of birth decides which divisions you can join. Ages are counted on opening day, March 29, 2026.
            </p>
          </div>
          <TableWrap>
            <DataTable>
              <TableHead>
                <tr>
                  <HeadCell>Division</HeadCell>
                  <HeadCell>Level</HeadCell>
                  <HeadCell>Who can play</HeadCell>
                  <HeadCell align="right">Fee</HeadCell>
                </tr>
              </TableHead>
              <TableBody>
                {DIVISIONS.map((d) => (
                  <BodyRow key={d.id}>
                    <BodyCell className="font-bold whitespace-nowrap">{d.name}</BodyCell>
                    <BodyCell className="text-muted">{d.level}</BodyCell>
                    <BodyCell className="min-w-[180px]">{d.age}</BodyCell>
                    <BodyCell align="right">
                      <b className="font-display text-[22px] font-extrabold">{money(d.fee)}</b>
                    </BodyCell>
                  </BodyRow>
                ))}
                <BodyRow>
                  <BodyCell className="whitespace-nowrap">
                    <b>Game pass</b> <span className="text-[13px] text-muted">· all divisions</span>
                  </BodyCell>
                  <BodyCell className="text-muted">Any</BodyCell>
                  <BodyCell className="min-w-[180px]">Must meet the division’s age rule</BodyCell>
                  <BodyCell align="right" className="whitespace-nowrap">
                    <b className="font-display text-[22px] font-extrabold">{money(GAME_PASS_FEE)}</b>{" "}
                    <span className="text-[13px] text-muted">/ match</span>
                  </BodyCell>
                </BodyRow>
              </TableBody>
            </DataTable>
          </TableWrap>
          <p className="text-[13.5px] text-muted">
            Board members, promo holders and teams that paid in full get a code to enter at checkout. Players must live or work in Fairfax
            County or an eligible ZIP code in Arlington or Alexandria.
          </p>
        </section>

        {/* This Sunday */}
        <section className={`flex flex-col gap-5 pb-12 ${section}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[32px]">This Sunday · May 17</h2>
            <span className="text-[13.5px] text-muted">{sunday.length} matches</span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-3.5">
            {sunday.map((m) => (
              <div key={m.id} className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[13px] text-muted">Game #{m.id}</span>
                  <span className="text-xs text-muted">{division(m.div).name}</span>
                </div>
                <VsRow {...vsFor(m)} />
                <MatchMeta date={m.date} time={m.time} field={m.field} />
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-line py-7">
        <div className={`flex flex-wrap items-center justify-between gap-3 text-[13.5px] text-muted ${section}`}>
          <Logo className="!text-lg text-fg" />
          <span>
            Northern Virginia Adult Soccer Association ·{" "}
            <a href="mailto:office@nvasa.org" className="font-semibold hover:text-fg">
              office@nvasa.org
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
