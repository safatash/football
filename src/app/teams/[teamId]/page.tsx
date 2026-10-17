import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Crest, Jersey } from "@/components/league";
import { RoleTag } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, EmptyState, KeyValue, Notice } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { BodyCell, BodyRow, DataTable, HeadCell, TableBody, TableHead, TableWrap } from "@/components/ui/table";
import { JsonLd, Kit, Leaders, MatchList, PageTitle, PlayerFace, PublicFrame, PublicStandings, SeasonTabs } from "@/components/public";
import { one, type PublicSearchParams } from "@/components/public/matches-page";
import { MemberMatchLinks, SuspendedBadge, ViewerProvider } from "@/components/public/viewer";
import { now } from "@/lib/clock";
import { getPublicTeam, listPublicMatches, resolvePublicSeason, teamCaptains, teamInSeason, teamRosterWithStats, type RosterRow } from "@/lib/queries/public";
import { loadStandings } from "@/lib/queries/standings";
import { appUrl } from "@/lib/stripe";

export const revalidate = 60;

type Params = Promise<{ teamId: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { teamId } = await params;
  const team = await getPublicTeam(teamId);
  if (!team) return { title: "Team" };
  return {
    title: `${team.name} · ${team.season.name}`,
    description: `${team.name} (${team.division.name}, ${team.season.name}): roster, scores, schedule and standings.`,
    alternates: { canonical: `/teams/${team.id}` },
  };
}

const SORTS: Record<string, [string, (a: RosterRow, b: RosterRow) => number]> = {
  jersey: ["#", (a, b) => (a.jersey ?? 999) - (b.jersey ?? 999)],
  name: ["Player", (a, b) => a.name.localeCompare(b.name)],
  gp: ["GP", (a, b) => b.gp - a.gp],
  g: ["G", (a, b) => b.goals - a.goals],
  a: ["A", (a, b) => b.assists - a.assists],
  y: ["Yellow", (a, b) => b.yellow - a.yellow],
  r: ["Red", (a, b) => b.red - a.red],
};

export default async function TeamPage({ params, searchParams }: { params: Params; searchParams: PublicSearchParams }) {
  const { teamId } = await params;
  const sp = await searchParams;
  const team = await getPublicTeam(teamId);
  if (!team) notFound();
  const { seasons, active } = await resolvePublicSeason(null);

  // ?season= picks the same club in another season, if it played then.
  const wanted = one(sp.season);
  const otherSeason = wanted && wanted !== team.season.slug ? seasons.find((s) => s.slug === wanted) : null;
  if (otherSeason) {
    const same = await teamInSeason(team, otherSeason.id);
    if (same) redirect(`/teams/${same.id}${otherSeason.id === active?.id ? "" : `?season=${otherSeason.slug}`}`);
  }

  const [captains, roster, standings, matches] = await Promise.all([
    teamCaptains(team.id),
    teamRosterWithStats(team.id),
    loadStandings(team.seasonId, team.division.id),
    listPublicMatches(team.seasonId, "all", { teamId: team.id }),
  ]);
  const row = standings.find((r) => r.team.id === team.id);
  const sortKey = SORTS[one(sp.sort)] ? one(sp.sort) : "jersey";
  const sorted = [...roster].sort((a, b) => SORTS[sortKey][1](a, b) || (a.jersey ?? 999) - (b.jersey ?? 999));
  const goalLeader = [...roster].filter((r) => r.goals > 0).sort((a, b) => b.goals - a.goals || b.assists - a.assists)[0];
  const assistLeader = [...roster].filter((r) => r.assists > 0).sort((a, b) => b.assists - a.assists || b.goals - a.goals)[0];
  const at = now();
  const seasonQuery = team.season.id === active?.id ? "" : `?season=${team.season.slug}`;
  const crest = { id: team.id, name: team.name, color: team.color, shortName: team.shortName, logoUrl: team.logoUrl };

  return (
    <PublicFrame>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SportsTeam",
          name: team.name,
          sport: "Soccer",
          url: `${appUrl()}/teams/${team.id}`,
          ...(team.logoUrl ? { logo: `${appUrl()}${team.logoUrl}` } : {}),
          memberOf: { "@type": "SportsOrganization", name: "NVASA" },
          athlete: roster.map((r) => ({ "@type": "Person", name: r.name })),
        }}
      />
      <div className="flex flex-wrap items-center gap-4">
        <Crest team={crest} size="lg" />
        <PageTitle eyebrow={`${team.division.name} · ${team.season.name}`} title={team.name} sub={row ? `${row.w}-${row.d}-${row.l} · ${row.pts} pts` : undefined} />
      </div>
      <SeasonTabs seasons={seasons} current={team.season} href={(slug) => `/teams/${team.id}${slug === team.season.slug ? "" : `?season=${slug}`}`} />
      {otherSeason ? <Notice tone="info">This team didn’t play in {otherSeason.name}. Showing {team.season.name}.</Notice> : null}

      <nav aria-label="Team sections" className="no-scrollbar flex gap-1.5 overflow-x-auto">
        {[
          ["#info", "Team info"],
          ["#matches", "Scores & schedule"],
          ["#roster", "Roster"],
          ["#standings", "Standings"],
        ].map(([href, label]) => (
          <a key={href} href={href} className="whitespace-nowrap rounded-full border border-line-strong px-3.5 py-2 text-[13.5px] font-bold hover:bg-surface-2">
            {label}
          </a>
        ))}
      </nav>

      <ViewerProvider teamIds={[team.id]}>
        <section id="info" className="grid scroll-mt-28 gap-4 md:grid-cols-2 lg:grid-cols-3" aria-labelledby="info-h">
          <h2 id="info-h" className="sr-only">
            Team info
          </h2>
          <Card className="flex flex-col gap-3">
            <KeyValue
              items={[
                ["Division", team.division.name],
                ["Record", row ? `${row.w}-${row.d}-${row.l} (W-D-L)` : "—"],
                ["Points", row ? String(row.pts) : "—"],
                ["Formation", team.formation || "No formation set yet"],
                ["Captains", captains.length ? captains.join(", ") : "—"],
                ...(team.homeField ? ([["Home field", team.homeField]] as [string, string][]) : []),
              ]}
            />
          </Card>
          <Card className="flex flex-col gap-4">
            <Kit label="Home kit" shirt={team.homeShirt} shorts={team.homeShorts} />
            <Kit label="Away kit" shirt={team.awayShirt} shorts={team.awayShorts} />
            {!team.homeShirt && !team.awayShirt ? <p className="text-sm text-muted">Kit colors not set yet.</p> : null}
          </Card>
          {team.photoUrl ? (
            <Card className="!p-0 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element -- team photos are static files */}
              <img src={team.photoUrl} alt={`${team.name} team photo`} className="aspect-[13/10] w-full object-cover" />
            </Card>
          ) : null}
        </section>

        <section id="matches" className="flex scroll-mt-28 flex-col gap-2.5" aria-labelledby="matches-h">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="matches-h" className="text-[26px]">
              Scores & schedule
            </h2>
            <ButtonLink href={`/teams/${team.id}/calendar.ics`} variant="ghost" size="sm">
              <Icon name="cal" className="size-4" />
              Add to calendar
            </ButtonLink>
          </div>
          <MatchList
            matches={matches}
            caption={`${team.name} games, ${team.season.name}`}
            teamHref={(id) => `/teams/${id}`}
            matchHref={(m) => `/matches/${m.id}`}
            showDivision={false}
            extra={(m) => <MemberMatchLinks teamId={team.id} gameNumber={m.gameNumber} upcoming={m.status === "SCHEDULED" && m.scheduledAt > at} />}
            empty={<EmptyState icon="cal" title="No games scheduled yet" />}
          />
        </section>

        <section id="roster" className="flex scroll-mt-28 flex-col gap-2.5" aria-labelledby="roster-h">
          <h2 id="roster-h" className="text-[26px]">
            Roster
          </h2>
          {sorted.length ? (
            <TableWrap>
              <DataTable className="text-sm">
                <caption className="sr-only">{`${team.name} roster and season stats`}</caption>
                <TableHead>
                  <tr>
                    {(["jersey", "name"] as const).map((k) => (
                      <HeadCell key={k}>
                        <Link href={`/teams/${team.id}?sort=${k}${seasonQuery ? `&${seasonQuery.slice(1)}` : ""}#roster`} aria-sort={sortKey === k ? "ascending" : undefined} className="hover:text-fg">
                          {SORTS[k][0]}
                        </Link>
                      </HeadCell>
                    ))}
                    <HeadCell>Position</HeadCell>
                    {(["gp", "g", "a", "y", "r"] as const).map((k) => (
                      <HeadCell key={k} align="right">
                        <Link href={`/teams/${team.id}?sort=${k}${seasonQuery ? `&${seasonQuery.slice(1)}` : ""}#roster`} aria-sort={sortKey === k ? "descending" : undefined} className="hover:text-fg">
                          {SORTS[k][0]}
                        </Link>
                      </HeadCell>
                    ))}
                  </tr>
                </TableHead>
                <TableBody>
                  {sorted.map((p) => (
                    <BodyRow key={p.id}>
                      <BodyCell className="w-12 !pr-0">
                        <Jersey n={p.jersey ?? "–"} small />
                      </BodyCell>
                      <BodyCell className="min-w-[200px]">
                        <span className="flex items-center gap-2.5">
                          <PlayerFace name={p.name} photoUrl={p.photoUrl} />
                          <Link href={`/players/${p.playerId}`} className="font-bold hover:underline">
                            {p.name}
                          </Link>
                          {p.captain ? <RoleTag role="Captain" /> : null}
                          <SuspendedBadge playerId={p.playerId} />
                        </span>
                      </BodyCell>
                      <BodyCell className="whitespace-nowrap text-muted">{p.position || "—"}</BodyCell>
                      <BodyCell align="right">{p.gp}</BodyCell>
                      <BodyCell align="right" className="font-bold">
                        {p.goals}
                      </BodyCell>
                      <BodyCell align="right">{p.assists}</BodyCell>
                      <BodyCell align="right">{p.yellow}</BodyCell>
                      <BodyCell align="right">{p.red}</BodyCell>
                    </BodyRow>
                  ))}
                </TableBody>
              </DataTable>
            </TableWrap>
          ) : (
            <EmptyState icon="users" title="No players listed yet" />
          )}
        </section>
      </ViewerProvider>

      <section id="standings" className="grid scroll-mt-28 gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start" aria-labelledby="standings-h">
        <div className="flex min-w-0 flex-col gap-2.5">
          <div className="flex items-end justify-between gap-3">
            <h2 id="standings-h" className="text-[26px]">
              {team.division.name} standings
            </h2>
            <Link href={`/standings${seasonQuery}`} className="text-[13.5px] font-bold text-pitch-2 underline underline-offset-4 dark:text-lime">
              All standings
            </Link>
          </div>
          <PublicStandings rows={standings} caption={`${team.division.name} standings, ${team.season.name}`} highlight={team.id} teamHref={(id) => `/teams/${id}`} />
        </div>
        <div className="flex flex-col gap-4">
          <Leaders title="Goal leader" unit="goal" playerHref={(id) => `/players/${id}`} leaders={goalLeader ? [{ playerId: goalLeader.playerId, name: goalLeader.name, photoUrl: goalLeader.photoUrl, team: crest, count: goalLeader.goals }] : []} />
          <Leaders title="Assist leader" unit="assist" playerHref={(id) => `/players/${id}`} leaders={assistLeader ? [{ playerId: assistLeader.playerId, name: assistLeader.name, photoUrl: assistLeader.photoUrl, team: crest, count: assistLeader.assists }] : []} />
        </div>
      </section>
    </PublicFrame>
  );
}
