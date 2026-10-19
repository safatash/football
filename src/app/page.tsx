import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { Badge, GamePassTag } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { BodyCell, BodyRow, DataTable, HeadCell, TableBody, TableHead, TableWrap } from "@/components/ui/table";
import { Crest, Logo, MatchMeta, VsRow } from "@/components/league";
import { db } from "@/lib/db";
import { fmtShort, fmtWeekday, money } from "@/lib/format";
import { getBrand } from "@/lib/branding";
import { listMatches, nextMatchDay } from "@/lib/queries/matches";
import { getActiveSeason, getSettings } from "@/lib/queries/season";
import { listPublicMatches } from "@/lib/queries/public";
import { gameNo } from "@/lib/public";
import { Score } from "@/components/public";

export async function generateMetadata(): Promise<Metadata> {
  const b = await getBrand();
  return { title: { absolute: b.fullName === b.name ? b.name : `${b.name} · ${b.fullName}` }, description: b.tagline ?? undefined };
}

/** Who can register, from the league's eligibility setting. */
function eligibilityLine(s: { eligibilityMode: string; eligibleCounties: string[] }) {
  if (s.eligibilityMode === "COUNTY_LIST" && s.eligibleCounties.length) return `Players must live or work in ${s.eligibleCounties.join(", ")} or an eligible ZIP code.`;
  if (s.eligibilityMode === "ZIP_LIST" || s.eligibilityMode === "COUNTY_LIST") return "Players must live or work in an eligible ZIP code.";
  return null;
}

// League data changes all the time; render on every request.
export const dynamic = "force-dynamic";

type DivisionRow = {
  id: string;
  name: string;
  level: string | null;
  registrationFee: { toString(): string };
  genderRule: "WOMEN" | "MEN" | "COED";
  maleBornOnOrBefore: Date | null;
  femaleBornOnOrBefore: Date | null;
  minAge: number;
};

/** Date-only columns are stored at UTC midnight. */
const mdy = (d: Date) => d.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric", timeZone: "UTC" });
const monthDay = (d: Date) => d.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
const monthDayYear = (d: Date) => d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

/** "18+", "Born on or before 12/31/2008" or "Men born ≤ … · Women ≤ …". */
function whoCanPlay(d: DivisionRow, openingDay: Date) {
  const ageCutoff = `${openingDay.getUTCFullYear() - d.minAge}${openingDay.toISOString().slice(4, 10)}`;
  const one = (c: Date | null) => (!c || c.toISOString().slice(0, 10) === ageCutoff ? `${d.minAge}+` : `Born on or before ${mdy(c)}`);
  if (d.genderRule === "WOMEN") return one(d.femaleBornOnOrBefore);
  if (d.genderRule === "MEN") return one(d.maleBornOnOrBefore);
  const [m, f] = [d.maleBornOnOrBefore, d.femaleBornOnOrBefore];
  if (m && f && m.getTime() !== f.getTime()) return `Men born ≤ ${mdy(m)} · Women ≤ ${mdy(f)}`;
  return one(m ?? f);
}

async function loadLanding() {
  const season = await getActiveSeason();
  if (!season) return null;
  const [divisions, teams, fields, settings, matches] = await Promise.all([
    db.division.findMany({
      where: { seasonId: season.id, status: "ACTIVE" },
      select: { id: true, name: true, level: true, registrationFee: true, genderRule: true, maleBornOnOrBefore: true, femaleBornOnOrBefore: true, minAge: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    }),
    db.team.count({ where: { seasonId: season.id } }),
    db.match.findMany({ where: { seasonId: season.id, location: { not: null } }, distinct: ["location"], select: { location: true } }),
    getSettings(season.id),
    listMatches(season.id),
  ]);
  const latest = await listPublicMatches(season.id, "results");
  return { season, divisions, teams, fields: fields.length, gamePassFee: settings.gamePassFee, eligibility: eligibilityLine(settings), next: nextMatchDay(matches), latest: latest.slice(0, 6) };
}

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

export default async function LandingPage() {
  const [data, brand] = await Promise.all([loadLanding(), getBrand()]);
  const divisions = data?.divisions ?? [];
  const fees = divisions.map((d) => Number(d.registrationFee));
  const feeMin = fees.length ? Math.min(...fees) : 0;
  const feeMax = fees.length ? Math.max(...fees) : 0;
  const gamePassFee = data?.gamePassFee ?? 15;
  const sunday = data?.next.matches ?? [];
  const seasonName = data?.season.name ?? "";
  // The weekday games are played, from the next match day (most leagues play one day a week)
  const gameDay = sunday[0] ? fmtWeekday(sunday[0].scheduledAt) : null;

  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero */}
      <div className="relative overflow-hidden bg-pitch text-white">
        <PitchLines />
        <nav aria-label={brand.name} className={`relative z-[2] flex items-center gap-3 py-3.5 sm:gap-4 ${section}`}>
          <Logo tone="light" />
          <span className="flex-1" />
          <Link href="/standings" className="hidden text-[13.5px] font-bold text-white sm:inline">
            Standings
          </Link>
          <Link href="/results" className="hidden text-[13.5px] font-bold text-white sm:inline">
            Results
          </Link>
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
            <span className="eyebrow !text-lime">
              {data ? `${seasonName} · ${gameDay ? `Games every ${gameDay}` : "Season"} through ${monthDay(data.season.endDate)}` : brand.name}
            </span>
            <h1 className="text-[clamp(46px,7vw,88px)] leading-[.9] uppercase">
              {brand.fullName}
            </h1>
            {brand.tagline ? <p className="max-w-[52ch] text-lg text-white/85">{brand.tagline}</p> : null}
            <div className="flex flex-wrap gap-[18px] text-sm font-semibold text-white/85">
              <span className="inline-flex items-center gap-1.5">
                <Icon name="shield" className="size-[18px]" />
                {divisions.length} divisions
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Icon name="users" className="size-[18px]" />
                {data?.teams ?? 0} teams
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Icon name="pin" className="size-[18px]" />
                {data?.fields ?? 0} fields
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
                <span className="font-display text-[44px] leading-none font-extrabold">{money(gamePassFee)}</span>
                <span className="text-sm text-muted">one game, one day</span>
              </div>
              <p className="text-sm text-muted">
                Pick a match, pay, and play. Good for that game day only. It doesn’t add you to a team.
              </p>
              <ButtonLink href="/register/game-pass" variant="primary" block>
                Buy a game pass {money(gamePassFee)} <Icon name="right" className="size-[18px]" />
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
              <span className="eyebrow">{seasonName}</span>
              <h2 className="text-[40px]">Divisions & fees</h2>
            </div>
            <p className="max-w-[48ch] text-muted">
              Your date of birth decides which divisions you can join.
              {data ? ` Ages are counted on opening day, ${monthDayYear(data.season.startDate)}.` : ""}
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
                {divisions.map((d) => (
                  <BodyRow key={d.id}>
                    <BodyCell className="font-bold whitespace-nowrap">{d.name}</BodyCell>
                    <BodyCell className="text-muted">{d.level}</BodyCell>
                    <BodyCell className="min-w-[180px]">{whoCanPlay(d, data!.season.startDate)}</BodyCell>
                    <BodyCell align="right">
                      <b className="font-display text-[22px] font-extrabold">{money(d.registrationFee)}</b>
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
                    <b className="font-display text-[22px] font-extrabold">{money(gamePassFee)}</b>{" "}
                    <span className="text-[13px] text-muted">/ match</span>
                  </BodyCell>
                </BodyRow>
              </TableBody>
            </DataTable>
          </TableWrap>
          <p className="text-[13.5px] text-muted">
            Board members, promo holders and teams that paid in full get a code to enter at checkout.{data?.eligibility ? ` ${data.eligibility}` : ""}
          </p>
        </section>

        {/* The next match day */}
        {sunday.length ? (
        <section className={`flex flex-col gap-5 pb-12 ${section}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[32px]">This {gameDay} · {fmtShort(sunday[0].scheduledAt)}</h2>
            <span className="text-[13.5px] text-muted">{sunday.length} matches</span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-3.5">
            {sunday.map((m) => (
              <div key={m.id} className="relative flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 hover:bg-surface-2">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/matches/${m.id}`} className="font-mono text-[13px] text-muted after:absolute after:inset-0 hover:underline">
                    Game #{m.gameNumber}
                  </Link>
                  <span className="text-xs text-muted">{m.division?.name ?? m.homeTeam.division.name}</span>
                </div>
                <VsRow home={m.homeTeam} away={m.awayTeam} />
                <MatchMeta date={m.date} time={m.time} field={m.field} />
              </div>
            ))}
          </div>
        </section>
        ) : null}

        {/* Latest results */}
        {data?.latest.length ? (
          <section className={`flex flex-col gap-5 pb-12 ${section}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[32px]">Latest results</h2>
              <Link href="/results" className="text-[13.5px] font-bold text-pitch-2 underline underline-offset-4 dark:text-lime">
                All results
              </Link>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-3.5">
              {data.latest.map((m) => (
                <div key={m.id} className="relative flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 hover:bg-surface-2">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/matches/${m.id}`} className="font-mono text-[13px] text-muted after:absolute after:inset-0 hover:underline">
                      Game {gameNo(m.gameNumber)}
                    </Link>
                    <span className="text-xs text-muted">{m.division?.name}</span>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 font-bold">
                    <span className="flex min-w-0 items-center gap-2">
                      <Crest team={m.homeTeam} />
                      <span className="truncate">{m.homeTeam.name}</span>
                    </span>
                    <Score m={m} />
                    <span className="flex min-w-0 items-center justify-end gap-2 text-right">
                      <span className="truncate">{m.awayTeam.name}</span>
                      <Crest team={m.awayTeam} />
                    </span>
                  </div>
                  <span className="text-[13px] text-muted">{m.dayLabel}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </main>

      <footer className="border-t border-line py-7">
        <div className={`flex flex-wrap items-center justify-between gap-3 text-[13.5px] text-muted ${section}`}>
          <Logo className="!text-lg text-fg" />
          <span className="flex flex-wrap gap-4 font-bold">
            <Link href="/standings" className="hover:text-fg">
              Standings
            </Link>
            <Link href="/results" className="hover:text-fg">
              Results
            </Link>
            {brand.social.map((s) => (
              <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="hover:text-fg">
                {s.label}
              </a>
            ))}
          </span>
          <span>
            {brand.fullName}
            {brand.contactEmail ? (
              <>
                {" · "}
                <a href={`mailto:${brand.contactEmail}`} className="font-semibold hover:text-fg">
                  {brand.contactEmail}
                </a>
              </>
            ) : null}
          </span>
        </div>
      </footer>
    </div>
  );
}
