import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Crest } from "@/components/league";
import { Badge } from "@/components/ui/badge";
import { Card, EmptyState } from "@/components/ui/card";
import { Segmented } from "@/components/ui/controls";
import { BodyCell, BodyRow, DataTable, HeadCell, TableBody, TableHead, TableWrap } from "@/components/ui/table";
import { Leaders, MatchList, PageTitle, PublicFrame, PublicStandings } from "@/components/public";
import { one, type PublicSearchParams } from "@/components/public/matches-page";
import { money } from "@/lib/format";
import { ageLabel } from "@/lib/queries/admin-league";
import { divisionPlayerStats, divisionsOf, listPublicMatches, publicDivision, resolvePublicSeason } from "@/lib/queries/public";
import { loadStandings, seasonLeaders, topBy } from "@/lib/queries/standings";

export const revalidate = 60;
const PER_PAGE = 25;

type Params = Promise<{ code: string }>;

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: PublicSearchParams }): Promise<Metadata> {
  const [{ code }, sp] = await Promise.all([params, searchParams]);
  const { season } = await resolvePublicSeason(one(sp.season));
  const d = season ? await publicDivision(season.id, code) : null;
  if (!d || !season) return { title: "Division" };
  return { title: `${d.name} · ${season.name}`, description: `${d.name} standings, teams, schedule and player stats for ${season.name}.`, alternates: { canonical: `/divisions/${d.code}` } };
}

export default async function DivisionPage({ params, searchParams }: { params: Params; searchParams: PublicSearchParams }) {
  const [{ code }, sp] = await Promise.all([params, searchParams]);
  const { season, active } = await resolvePublicSeason(one(sp.season));
  if (!season) notFound();
  const division = await publicDivision(season.id, code);
  if (!division) notFound();
  const page = Math.max(1, Math.floor(Number(one(sp.page)) || 1));
  const [divisions, standings, leaders, stats, matches] = await Promise.all([
    divisionsOf(season.id),
    loadStandings(season.id, division.id),
    seasonLeaders(season.id),
    divisionPlayerStats(season.id, division.id, page, PER_PAGE),
    listPublicMatches(season.id, "all", { divisionCode: division.code }),
  ]);
  const inDiv = leaders.filter((l) => l.divisionId === division.id);
  const seasonQ = season.id === active?.id ? "" : `season=${season.slug}`;
  const pages = Math.max(1, Math.ceil(stats.total / PER_PAGE));
  const pageHref = (n: number) => `/divisions/${division.code}?${[seasonQ, n > 1 ? `page=${n}` : ""].filter(Boolean).join("&")}#stats`;

  return (
    <PublicFrame>
      <Segmented label="Divisions" active={division.code} items={divisions.map((d) => ({ key: d.code, label: d.name, href: `/divisions/${d.code}${seasonQ ? `?${seasonQ}` : ""}` }))} />
      <PageTitle
        eyebrow={season.name}
        title={division.name}
        sub={division.description ?? undefined}
        actions={
          <span className="flex flex-wrap gap-1.5">
            {division.level ? <Badge dot={false}>{division.level}</Badge> : null}
            <Badge dot={false}>{ageLabel(division, season.startDate)}</Badge>
            <Badge tone="info" dot={false}>
              {money(division.registrationFee)} to register
            </Badge>
          </span>
        }
      />

      <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3" aria-label="Teams">
        {standings.map((r) => (
          <li key={r.team.id}>
            <Card className="flex items-center gap-3 !p-3.5">
              <Crest team={r.team} size="lg" />
              <div className="min-w-0 flex-1">
                <b className="block truncate">{r.team.name}</b>
                <span className="text-[13px] text-muted">{r.pts} pts</span>
              </div>
              <Link href={`/teams/${r.team.id}`} className="text-[13px] font-bold text-pitch-2 underline underline-offset-4 dark:text-lime">
                View team
              </Link>
            </Card>
          </li>
        ))}
      </ul>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start" aria-labelledby="standings-h">
        <div className="flex min-w-0 flex-col gap-2.5">
          <h2 id="standings-h" className="text-[26px]">
            Standings
          </h2>
          <PublicStandings rows={standings} caption={`${division.name} standings, ${season.name}`} teamHref={(id) => `/teams/${id}`} />
        </div>
        <div className="flex flex-col gap-4">
          <Leaders title="Goal leader" unit="goal" playerHref={(id) => `/players/${id}`} leaders={topBy(inDiv, "goals", 1).map((l) => ({ ...l, count: l.goals }))} />
          <Leaders title="Assist leader" unit="assist" playerHref={(id) => `/players/${id}`} leaders={topBy(inDiv, "assists", 1).map((l) => ({ ...l, count: l.assists }))} />
        </div>
      </section>

      <section id="stats" className="flex scroll-mt-28 flex-col gap-2.5" aria-labelledby="stats-h">
        <h2 id="stats-h" className="text-[26px]">
          Player stats
        </h2>
        {stats.rows.length ? (
          <>
            <TableWrap>
              <DataTable className="text-sm">
                <caption className="sr-only">{`${division.name} player stats, page ${page} of ${pages}`}</caption>
                <TableHead>
                  <tr>
                    <HeadCell>Player</HeadCell>
                    <HeadCell>Team</HeadCell>
                    <HeadCell align="right">G</HeadCell>
                    <HeadCell align="right">A</HeadCell>
                    <HeadCell align="right">GP</HeadCell>
                    <HeadCell align="right">Yellow</HeadCell>
                    <HeadCell align="right">Red</HeadCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {stats.rows.map((r) => (
                    <BodyRow key={`${r.playerId}-${r.teamId}`}>
                      <BodyCell className="min-w-[160px]">
                        <Link href={`/players/${r.playerId}`} className="font-bold hover:underline">
                          {r.name}
                        </Link>
                      </BodyCell>
                      <BodyCell className="whitespace-nowrap">
                        <Link href={`/teams/${r.teamId}`} className="hover:underline">
                          {r.teamName}
                        </Link>
                      </BodyCell>
                      <BodyCell align="right" className="font-bold">
                        {r.goals}
                      </BodyCell>
                      <BodyCell align="right">{r.assists}</BodyCell>
                      <BodyCell align="right">{r.gp}</BodyCell>
                      <BodyCell align="right">{r.yellow}</BodyCell>
                      <BodyCell align="right">{r.red}</BodyCell>
                    </BodyRow>
                  ))}
                </TableBody>
              </DataTable>
            </TableWrap>
            {pages > 1 ? (
              <nav aria-label="Player stats pages" className="flex items-center justify-between gap-3 text-sm">
                {page > 1 ? <Link href={pageHref(page - 1)} className="font-bold underline underline-offset-4">Previous</Link> : <span />}
                <span className="text-muted">
                  Page {page} of {pages}
                </span>
                {page < pages ? <Link href={pageHref(page + 1)} className="font-bold underline underline-offset-4">Next</Link> : <span />}
              </nav>
            ) : null}
          </>
        ) : (
          <EmptyState icon="users" title="No stats yet">
            Player stats appear once match reports are confirmed.
          </EmptyState>
        )}
      </section>

      <section className="flex flex-col gap-2.5" aria-labelledby="schedule-h">
        <h2 id="schedule-h" className="text-[26px]">
          Schedule & results
        </h2>
        <MatchList
          matches={matches}
          caption={`${division.name} schedule and results, ${season.name}`}
          teamHref={(id) => `/teams/${id}`}
          matchHref={(m) => `/matches/${m.id}`}
          showDivision={false}
          empty={<EmptyState icon="cal" title="No games yet" />}
        />
      </section>
    </PublicFrame>
  );
}
