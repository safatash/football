import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Crest } from "@/components/league";
import { Badge } from "@/components/ui/badge";
import { Card, EmptyState, KeyValue } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { BodyCell, BodyRow, DataTable, HeadCell, TableBody, TableHead, TableWrap } from "@/components/ui/table";
import { Directions, JsonLd, PublicFrame, Score, placeOf } from "@/components/public";
import { addressLine } from "@/lib/public";
import { one, type PublicSearchParams } from "@/components/public/matches-page";
import { EditReportLink, ViewerProvider } from "@/components/public/viewer";
import { gameNo } from "@/lib/public";
import { getPublicMatch, publicMatchReport, resolvePublicSeason, type PublicMatch } from "@/lib/queries/public";
import { appUrl } from "@/lib/stripe";

export const revalidate = 60;

type Params = Promise<{ matchId: string }>;

/** A match id, or a game number in the active (or ?season=) season. */
async function load(ref: string, seasonSlug: string) {
  const { season } = await resolvePublicSeason(seasonSlug || null);
  return getPublicMatch(ref, season?.id);
}

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: PublicSearchParams }): Promise<Metadata> {
  const [{ matchId }, sp] = await Promise.all([params, searchParams]);
  const m = await load(matchId, one(sp.season));
  if (!m) return { title: "Match" };
  const title = `Game ${gameNo(m.gameNumber)}: ${m.homeTeam.name} vs ${m.awayTeam.name}`;
  return {
    title,
    description: `${title}, ${m.dayLabel} ${m.time}${m.played ? ` · Final ${m.homeScore}–${m.awayScore}` : ""}. Lineups, scorers and cards.`,
    alternates: { canonical: `/matches/${m.id}` },
  };
}

type Lines = Awaited<ReturnType<typeof publicMatchReport>>[string]["lines"];

function TeamSheet({ team, score, lines }: { team: PublicMatch["homeTeam"]; score: number | null; lines: Lines | null }) {
  return (
    <section className="flex min-w-0 flex-col gap-2.5" aria-label={team.name}>
      <div className="flex items-center gap-3">
        <Crest team={team} size="lg" />
        <Link href={`/teams/${team.id}`} className="min-w-0 flex-1 truncate font-display text-[22px] font-extrabold hover:underline">
          {team.name}
        </Link>
        {score != null ? <span className="font-display text-[34px] font-extrabold">{score}</span> : null}
      </div>
      {lines?.length ? (
        <TableWrap>
          <DataTable className="text-sm">
            <caption className="sr-only">{`${team.name} player stats`}</caption>
            <TableHead>
              <tr>
                <HeadCell>#</HeadCell>
                <HeadCell>Player</HeadCell>
                <HeadCell align="right">G</HeadCell>
                <HeadCell align="right">A</HeadCell>
                <HeadCell align="center">
                  <abbr title="Yellow card">Y</abbr>
                </HeadCell>
                <HeadCell align="center">
                  <abbr title="Second yellow">2nd Y</abbr>
                </HeadCell>
                <HeadCell align="center">
                  <abbr title="Red card">R</abbr>
                </HeadCell>
                <HeadCell align="center">
                  <abbr title="Started">In</abbr>
                </HeadCell>
                <HeadCell align="center">
                  <abbr title="Came on as a sub">Out</abbr>
                </HeadCell>
                <HeadCell>Note</HeadCell>
              </tr>
            </TableHead>
            <TableBody>
              {lines.map((l) => (
                <BodyRow key={l.playerId}>
                  <BodyCell className="text-muted">{l.jersey ?? "–"}</BodyCell>
                  <BodyCell className="min-w-[150px]">
                    <Link href={`/players/${l.playerId}`} className="font-bold hover:underline">
                      {l.name}
                    </Link>
                  </BodyCell>
                  <BodyCell align="right" className="font-bold">
                    {l.goals || ""}
                  </BodyCell>
                  <BodyCell align="right">{l.assists || ""}</BodyCell>
                  <BodyCell align="center">{l.yellow ? <span className="inline-block h-4 w-3 rounded-[2px] bg-warn" aria-label="Yellow card" /> : ""}</BodyCell>
                  <BodyCell align="center">{l.secondYellow ? <span className="inline-block h-4 w-3 rounded-[2px] bg-warn" aria-label="Second yellow card" /> : ""}</BodyCell>
                  <BodyCell align="center">{l.red ? <span className="inline-block h-4 w-3 rounded-[2px] bg-bad" aria-label="Red card" /> : ""}</BodyCell>
                  <BodyCell align="center">{l.inGame === "IN" ? <Icon name="check" className="mx-auto size-4 text-ok" label="Started" /> : ""}</BodyCell>
                  <BodyCell align="center">{l.inGame === "OUT" ? <Icon name="check" className="mx-auto size-4 text-muted" label="Came on" /> : ""}</BodyCell>
                  <BodyCell className="text-[13px] text-muted">{l.note ?? ""}</BodyCell>
                </BodyRow>
              ))}
            </TableBody>
          </DataTable>
        </TableWrap>
      ) : (
        <p className="text-sm text-muted">No player stats reported for {team.name}.</p>
      )}
    </section>
  );
}

export default async function MatchPage({ params, searchParams }: { params: Params; searchParams: PublicSearchParams }) {
  const [{ matchId }, sp] = await Promise.all([params, searchParams]);
  const m = await load(matchId, one(sp.season));
  if (!m) notFound();
  const report = m.played ? await publicMatchReport(m.id, [m.homeTeam.id, m.awayTeam.id]) : {};
  const hasReport = Object.keys(report).length > 0;
  const refs: [string, string][] = [
    ["Center", m.ref1 ?? "—"],
    ["AR1", m.ref2 ?? "—"],
    ["AR2", m.ref3 ?? "—"],
  ];

  return (
    <PublicFrame>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SportsEvent",
          name: `${m.homeTeam.name} vs ${m.awayTeam.name}`,
          sport: "Soccer",
          startDate: m.scheduledAt.toISOString(),
          eventStatus: m.status === "CANCELLED" ? "https://schema.org/EventCancelled" : m.status === "POSTPONED" ? "https://schema.org/EventPostponed" : "https://schema.org/EventScheduled",
          url: `${appUrl()}/matches/${m.id}`,
          homeTeam: { "@type": "SportsTeam", name: m.homeTeam.name, url: `${appUrl()}/teams/${m.homeTeam.id}` },
          awayTeam: { "@type": "SportsTeam", name: m.awayTeam.name, url: `${appUrl()}/teams/${m.awayTeam.id}` },
          ...(placeOf(m) ? { location: { "@type": "Place", name: placeOf(m), ...(m.venue && addressLine(m.venue) ? { address: addressLine(m.venue) } : {}) } } : {}),
        }}
      />
      <ViewerProvider teamIds={[m.homeTeam.id, m.awayTeam.id]}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="eyebrow">
              Game {gameNo(m.gameNumber)}
              {m.division ? ` · ${m.division.name}` : ""}
            </span>
            <h1 className="text-[28px] lg:text-[36px]">
              {m.homeTeam.name} vs {m.awayTeam.name}
            </h1>
          </div>
          <EditReportLink teamIds={[m.homeTeam.id, m.awayTeam.id]} gameNumber={m.gameNumber} />
        </div>
      </ViewerProvider>

      <Card className="flex flex-col gap-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
          <Link href={`/teams/${m.homeTeam.id}`} className="flex min-w-0 flex-col items-center gap-1.5 text-center font-bold hover:underline">
            <Crest team={m.homeTeam} size="lg" />
            <span className="truncate">{m.homeTeam.name}</span>
          </Link>
          <div className="flex flex-col items-center gap-1">
            {m.played ? <span className="text-[2rem]"><Score m={m} /></span> : <span className="font-display text-xl font-extrabold text-muted">VS</span>}
            {m.played && !m.confirmed ? <Badge dot={false}>Unconfirmed</Badge> : null}
            {m.status === "CANCELLED" || m.status === "POSTPONED" ? <Badge tone="warn">{m.status === "CANCELLED" ? "Cancelled" : "Postponed"}</Badge> : null}
          </div>
          <Link href={`/teams/${m.awayTeam.id}`} className="flex min-w-0 flex-col items-center gap-1.5 text-center font-bold hover:underline">
            <Crest team={m.awayTeam} size="lg" />
            <span className="truncate">{m.awayTeam.name}</span>
          </Link>
        </div>
        <div className="grid gap-4 border-t border-line pt-4 md:grid-cols-2">
          <KeyValue
            items={[
              ["Date", m.dayLabel],
              ["Kickoff", m.time],
              [
                "Location",
                <span key="l" className="flex flex-col items-end gap-0.5 text-right">
                  {placeOf(m) || "To be announced"}
                  {m.venue && addressLine(m.venue) ? <span className="text-[13px] text-muted">{addressLine(m.venue)}</span> : null}
                  <Directions m={m} />
                  {m.venue?.notes ? <span className="text-[13px] text-muted">Parking: {m.venue.notes}</span> : null}
                </span>,
              ],
            ]}
          />
          <KeyValue items={refs} />
        </div>
      </Card>

      {m.played && hasReport ? (
        <div className="flex flex-col gap-6">
          <TeamSheet team={m.homeTeam} score={m.homeScore} lines={report[m.homeTeam.id]?.lines ?? null} />
          <TeamSheet team={m.awayTeam} score={m.awayScore} lines={report[m.awayTeam.id]?.lines ?? null} />
        </div>
      ) : (
        <EmptyState icon="clip" title="Result not reported yet">
          {m.played ? "The score is in; player stats appear once a team submits its report." : "Scorers, cards and lineups show up here after the game."}
        </EmptyState>
      )}
    </PublicFrame>
  );
}
