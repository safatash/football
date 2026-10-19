import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar, Crest, type CrestTeam } from "@/components/league";
import { demoSummary } from "@/lib/demo";
import { getBrand } from "@/lib/branding";
import { Badge } from "@/components/ui/badge";
import { Card, EmptyState, Notice as NoticeBox } from "@/components/ui/card";
import { Segmented } from "@/components/ui/controls";
import { Icon } from "@/components/ui/icon";
import { BodyCell, BodyRow, DataTable, HeadCell, TableBody, TableHead, TableWrap } from "@/components/ui/table";
import { PublicMobileNav, PublicTopNav } from "@/components/shell/app-nav";
import { directionsUrl, gameNo, outcomeFor, placeLabel, scoreLabel } from "@/lib/public";
import type { PublicMatch, PublicSeason } from "@/lib/queries/public";
import type { StandingRow } from "@/lib/standings";

/* ------------------------------------------------------------------ */
/* Frame                                                               */
/* ------------------------------------------------------------------ */

/** Public league pages: top nav (desktop), league scroller (phones), footer. */
export function PublicFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicTopNav />
      <PublicMobileNav />
      <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col gap-5 px-4 pt-5 pb-10 lg:gap-6 lg:pt-8">
        <PublicDemoNotice />
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}

/** While seed data is in the database, say so: the teams, players and results aren't real. */
async function PublicDemoNotice() {
  const [{ teams }, brand] = await Promise.all([demoSummary(), getBrand()]);
  if (!teams) return null;
  return (
    <p role="note" className="rounded-xl border border-dashed border-line-strong bg-surface px-4 py-2.5 text-[13.5px] text-muted">
      <b className="text-fg">Preview:</b> the teams, players and results on these pages are demo data, not real {brand.name} teams.
    </p>
  );
}

export async function PublicFooter() {
  const brand = await getBrand();
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-5 text-[13.5px] text-muted">
        <span className="font-bold text-fg">{brand.name}</span>
        <Link href="/standings" className="hover:text-fg">
          Standings
        </Link>
        <Link href="/results" className="hover:text-fg">
          Results
        </Link>
        <Link href="/register" className="hover:text-fg">
          Register
        </Link>
        <span className="flex-1" />
        {brand.social.map((s) => (
          <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="font-bold hover:text-fg">
            {s.label}
          </a>
        ))}
      </div>
    </footer>
  );
}

export function PageTitle({ eyebrow, title, sub, actions }: { eyebrow?: ReactNode; title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h1 className="text-[32px] lg:text-[42px]">{title}</h1>
        {sub ? <p className="text-muted">{sub}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2.5">{actions}</div> : null}
    </div>
  );
}

/** Season tabs as links (`?season=slug`), keeping other params. */
export function SeasonTabs({ seasons, current, href }: { seasons: PublicSeason[]; current: PublicSeason; href: (slug: string) => string }) {
  if (seasons.length < 2) return null;
  return <Segmented label="Season" className="lg:max-w-[560px]" active={current.slug} items={seasons.map((s) => ({ key: s.slug, label: s.name, href: href(s.slug) }))} />;
}

/* ------------------------------------------------------------------ */
/* Matches                                                             */
/* ------------------------------------------------------------------ */

export function TeamLink({ team, href }: { team: CrestTeam & { id: string }; href: string }) {
  return (
    <Link href={href} className="flex min-w-0 items-center gap-2 font-bold hover:underline">
      <Crest team={team} />
      <span className="truncate">{team.name}</span>
    </Link>
  );
}

/** "2 : 0" with the winner green and loser red; draws neutral. Text says who won for screen readers. */
export function Score({ m, href }: { m: Pick<PublicMatch, "homeScore" | "awayScore" | "played" | "homeTeam" | "awayTeam">; href?: string }) {
  if (!m.played || m.homeScore == null || m.awayScore == null) {
    const empty = <span className="font-display text-lg font-extrabold text-muted">—</span>;
    return href ? <Link href={href} aria-label="Match details" className="hover:underline">{empty}</Link> : empty;
  }
  const h = outcomeFor(m.homeScore, m.awayScore);
  const tone = (o: string) => (o === "W" ? "text-ok" : o === "L" ? "text-bad" : "");
  const body = (
    <span className="inline-flex items-baseline gap-1.5 font-display text-xl font-extrabold tabular-nums" aria-label={scoreLabel(m.homeTeam.name, m.awayTeam.name, m.homeScore, m.awayScore)}>
      <span className={tone(h)}>{m.homeScore}</span>
      <span className="text-muted">:</span>
      <span className={tone(outcomeFor(m.awayScore, m.homeScore))}>{m.awayScore}</span>
    </span>
  );
  return href ? (
    <Link href={href} className="hover:underline">
      {body}
    </Link>
  ) : (
    body
  );
}

export function Directions({ m }: { m: Pick<PublicMatch, "venue" | "field" | "location"> }) {
  const url = directionsUrl(m.venue, m.venue ? null : (m.location ?? m.field));
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[13px] font-bold text-pitch-2 underline underline-offset-4 dark:text-lime">
      <Icon name="pin" className="size-3.5" />
      Directions
    </a>
  );
}

export const placeOf = (m: Pick<PublicMatch, "venue" | "field">) => placeLabel(m.venue, m.field);

type MatchListProps = {
  matches: PublicMatch[];
  caption: string;
  teamHref: (id: string) => string;
  matchHref: (m: PublicMatch) => string;
  showDivision?: boolean;
  /** Extra cells per row (e.g. Print / Manage for signed-in members). */
  extra?: (m: PublicMatch) => ReactNode;
  empty: ReactNode;
};

/** Matches as a table on desktop and as cards grouped by day on phones. */
export function MatchList({ matches, caption, teamHref, matchHref, showDivision = true, extra, empty }: MatchListProps) {
  if (!matches.length) return <>{empty}</>;
  const days = [...new Map(matches.map((m) => [m.dayKey, m.dayLabel])).entries()];
  return (
    <>
      <TableWrap className="hidden md:block">
        <DataTable>
          <caption className="sr-only">{caption}</caption>
          <TableHead>
            <tr>
              <HeadCell>Game</HeadCell>
              <HeadCell>Date</HeadCell>
              <HeadCell>Time</HeadCell>
              <HeadCell>Home</HeadCell>
              <HeadCell align="center">Score</HeadCell>
              <HeadCell>Away</HeadCell>
              {showDivision ? <HeadCell>Division</HeadCell> : null}
              <HeadCell>Location</HeadCell>
              {extra ? <HeadCell align="right"><span className="sr-only">Actions</span></HeadCell> : null}
            </tr>
          </TableHead>
          <TableBody>
            {matches.map((m) => (
              <BodyRow key={m.id}>
                <BodyCell className="font-mono text-[13px] text-muted">
                  <Link href={matchHref(m)} className="hover:underline">
                    {gameNo(m.gameNumber)}
                  </Link>
                </BodyCell>
                <BodyCell className="whitespace-nowrap">
                  <span className="text-muted">{m.day}</span> {m.date}
                </BodyCell>
                <BodyCell className="whitespace-nowrap">{m.time}</BodyCell>
                <BodyCell className="max-w-[200px]">
                  <TeamLink team={m.homeTeam} href={teamHref(m.homeTeam.id)} />
                </BodyCell>
                <BodyCell align="center" className="whitespace-nowrap">
                  <Score m={m} href={matchHref(m)} />
                  {m.played && !m.confirmed ? <div className="text-[11px] font-bold text-muted">Unconfirmed</div> : null}
                </BodyCell>
                <BodyCell className="max-w-[200px]">
                  <TeamLink team={m.awayTeam} href={teamHref(m.awayTeam.id)} />
                </BodyCell>
                {showDivision ? <BodyCell className="whitespace-nowrap text-[13.5px]">{m.division?.name ?? "—"}</BodyCell> : null}
                <BodyCell className="min-w-[180px] text-[13.5px]">
                  <div>{placeOf(m) || "—"}</div>
                  <Directions m={m} />
                </BodyCell>
                {extra ? <BodyCell align="right" className="whitespace-nowrap">{extra(m)}</BodyCell> : null}
              </BodyRow>
            ))}
          </TableBody>
        </DataTable>
      </TableWrap>

      <div className="flex flex-col gap-5 md:hidden">
        {days.map(([key, label]) => (
          <section key={key} className="flex flex-col gap-2.5" aria-label={label}>
            <h2 className="eyebrow">{label}</h2>
            {matches
              .filter((m) => m.dayKey === key)
              .map((m) => (
                <Card key={m.id} className="flex flex-col gap-2.5 !p-3.5">
                  <div className="flex items-center justify-between gap-2 text-[13px] text-muted">
                    <Link href={matchHref(m)} className="font-mono hover:underline">
                      Game {gameNo(m.gameNumber)}
                    </Link>
                    <span>
                      {m.time}
                      {showDivision && m.division ? ` · ${m.division.name}` : ""}
                    </span>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                    <TeamLink team={m.homeTeam} href={teamHref(m.homeTeam.id)} />
                    <div className="text-center">
                      <Score m={m} href={matchHref(m)} />
                    </div>
                    <div className="flex justify-end">
                      <Link href={teamHref(m.awayTeam.id)} className="flex min-w-0 items-center gap-2 font-bold hover:underline">
                        <span className="truncate text-right">{m.awayTeam.name}</span>
                        <Crest team={m.awayTeam} />
                      </Link>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-muted">
                    <span>{placeOf(m) || "Location to be announced"}</span>
                    <Directions m={m} />
                  </div>
                  {m.played && !m.confirmed ? <Badge dot={false} className="self-start">Unconfirmed</Badge> : null}
                  {extra ? <div className="flex flex-wrap gap-3">{extra(m)}</div> : null}
                </Card>
              ))}
          </section>
        ))}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Standings & leaders                                                 */
/* ------------------------------------------------------------------ */

type StandingTeam = CrestTeam & { id: string };

export function PublicStandings({ rows, caption, highlight, teamHref }: { rows: StandingRow<StandingTeam>[]; caption: string; highlight?: string; teamHref: (id: string) => string }) {
  if (!rows.length) return <EmptyState icon="trophy" title="No teams yet" />;
  return (
    <TableWrap>
      <DataTable className="text-sm">
        <caption className="sr-only">{caption}</caption>
        <TableHead>
          <tr>
            <HeadCell align="center">Rank</HeadCell>
            <HeadCell>Team</HeadCell>
            <HeadCell align="right">Pts</HeadCell>
            <HeadCell align="right">
              <abbr title="Games played">GP</abbr>
            </HeadCell>
            <HeadCell align="right">W</HeadCell>
            <HeadCell align="right">D</HeadCell>
            <HeadCell align="right">L</HeadCell>
            <HeadCell align="right">
              <abbr title="Goals for">GF</abbr>
            </HeadCell>
            <HeadCell align="right">
              <abbr title="Goals against">GA</abbr>
            </HeadCell>
            <HeadCell align="right">
              <abbr title="Goal difference">GD</abbr>
            </HeadCell>
          </tr>
        </TableHead>
        <TableBody>
          {rows.map((r, i) => (
            <BodyRow key={r.team.id} highlight={r.team.id === highlight}>
              <BodyCell align="center" className="font-bold">
                {i === 0 && r.played > 0 ? (
                  <span className="inline-flex items-center gap-1">
                    <Icon name="trophy" className="size-4 text-warn" label="First place" />1
                  </span>
                ) : (
                  i + 1
                )}
              </BodyCell>
              <BodyCell className="min-w-[180px]">
                <TeamLink team={r.team} href={teamHref(r.team.id)} />
              </BodyCell>
              <BodyCell align="right" className="font-display text-lg font-extrabold">
                {r.pts}
              </BodyCell>
              <BodyCell align="right">{r.played}</BodyCell>
              <BodyCell align="right">{r.w}</BodyCell>
              <BodyCell align="right">{r.d}</BodyCell>
              <BodyCell align="right">{r.l}</BodyCell>
              <BodyCell align="right">{r.gf}</BodyCell>
              <BodyCell align="right">{r.ga}</BodyCell>
              <BodyCell align="right">{r.gd > 0 ? `+${r.gd}` : r.gd}</BodyCell>
            </BodyRow>
          ))}
        </TableBody>
      </DataTable>
    </TableWrap>
  );
}

export type LeaderCard = { playerId: string; name: string; photoUrl: string | null; team: (CrestTeam & { id: string }) | null; count: number };

export function Leaders({ title, unit, leaders, playerHref }: { title: string; unit: "goal" | "assist"; leaders: LeaderCard[]; playerHref: (id: string) => string }) {
  return (
    <section className="flex flex-col gap-2.5" aria-label={title}>
      <h3 className="eyebrow">{title}</h3>
      {leaders.length ? (
        <div className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-1">
          {leaders.map((l, i) => (
            <Card key={l.playerId} className="flex items-center gap-3 !p-3">
              <PlayerFace name={l.name} photoUrl={l.photoUrl} />
              <div className="min-w-0 flex-1">
                <Link href={playerHref(l.playerId)} className="block truncate font-bold hover:underline">
                  {leaders.length > 1 ? <span className="text-muted">{i + 1}. </span> : null}
                  {l.name}
                </Link>
                {l.team ? <span className="block truncate text-xs text-muted">{l.team.name}</span> : null}
              </div>
              <span className="text-right">
                <b className="font-display text-2xl leading-none font-extrabold">{l.count}</b>
                <span className="block text-[11px] text-muted">{l.count === 1 ? unit : `${unit}s`}</span>
              </span>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">No {unit}s recorded yet.</p>
      )}
    </section>
  );
}

/** Photo only when the player allowed it; otherwise initials. */
export function PlayerFace({ name, photoUrl, size = "md" }: { name: string; photoUrl: string | null; size?: "md" | "lg" }) {
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- player photos are small static files
    return <img src={photoUrl} alt="" className={`shrink-0 rounded-full object-cover ${size === "lg" ? "size-20" : "size-[34px]"}`} />;
  }
  return <Avatar name={name} className={size === "lg" ? "!size-20 text-2xl" : ""} />;
}

/** Shirt and shorts color chips. */
export function Kit({ label, shirt, shorts }: { label: string; shirt: string | null; shorts: string | null }) {
  if (!shirt && !shorts) return null;
  const chip = (color: string | null, part: string) => (
    <span className="flex items-center gap-1.5 text-[13px]">
      <span className="size-6 rounded-md border border-line-strong" style={{ background: color ?? "transparent" }} aria-hidden />
      {part}
      <span className="sr-only">{color ?? "not set"}</span>
    </span>
  );
  return (
    <div className="flex flex-col gap-1.5">
      <b className="text-[13.5px]">{label}</b>
      <div className="flex gap-3">
        {chip(shirt, "Shirt")}
        {chip(shorts, "Shorts")}
      </div>
    </div>
  );
}

/** JSON-LD script for search engines. */
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

const NOTICES: Record<string, string> = {
  "team-not-found": "We couldn’t find that team from the old site. Here are this season’s teams.",
  "player-not-found": "We couldn’t find that player from the old site. Try their team’s roster.",
  "division-not-found": "We couldn’t find that division from the old site. Here are the standings.",
  "game-not-found": "We couldn’t find that game from the old site. Here are the results.",
  "season-not-found": "We couldn’t find that season. Showing the current one.",
};

/** Explains a redirect from an old link that didn't match anything. */
export function RedirectNotice({ code }: { code: string }) {
  const text = NOTICES[code];
  return text ? <NoticeBox>{text}</NoticeBox> : null;
}

/** A new league before its first season: say so instead of a 404. */
export async function NoSeasonYet({ title }: { title: string }) {
  const brand = await getBrand();
  return (
    <PublicFrame>
      <PageTitle title={title} />
      <EmptyState icon="cal" title="The first season isn’t posted yet">
        {brand.name} hasn’t published a season yet. Check back soon.
      </EmptyState>
    </PublicFrame>
  );
}
