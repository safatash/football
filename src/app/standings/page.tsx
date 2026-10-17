import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { EmptyState } from "@/components/ui/card";
import { Leaders, PageTitle, PublicFrame, PublicStandings, SeasonTabs } from "@/components/public";
import { one, type PublicSearchParams } from "@/components/public/matches-page";
import { resolvePublicSeason } from "@/lib/queries/public";
import { loadSeasonStandings, seasonLeaders, topBy } from "@/lib/queries/standings";

export const revalidate = 60;
export const metadata: Metadata = {
  title: "Standings",
  description: "NVASA standings for every division, with each division's top scorers.",
  alternates: { canonical: "/standings" },
};

export default async function StandingsPage({ searchParams }: { searchParams: PublicSearchParams }) {
  const sp = await searchParams;
  const { season, active, seasons } = await resolvePublicSeason(one(sp.season));
  if (!season) notFound();
  const [divisions, leaders] = await Promise.all([loadSeasonStandings(season.id), seasonLeaders(season.id)]);

  return (
    <PublicFrame>
      <PageTitle eyebrow={season.name} title="Standings" sub="3 points for a win, 1 for a draw. Ties go to goal difference, then goals scored." />
      <SeasonTabs seasons={seasons} current={season} href={(slug) => (slug === active?.slug ? "/standings" : `/standings?season=${slug}`)} />
      {divisions.length ? null : <EmptyState icon="trophy" title={`No divisions in ${season.name}`} />}
      {divisions.map(({ division, rows }) => (
        <section key={division.id} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start" aria-labelledby={`div-${division.code}`}>
          <div className="flex min-w-0 flex-col gap-2.5">
            <div className="flex items-end justify-between gap-3">
              <h2 id={`div-${division.code}`} className="text-[26px]">
                {division.name}
              </h2>
              <Link href={`/divisions/${division.code}${season.id === active?.id ? "" : `?season=${season.slug}`}`} className="text-[13.5px] font-bold text-pitch-2 underline underline-offset-4 dark:text-lime">
                Division page
              </Link>
            </div>
            <PublicStandings rows={rows} caption={`${division.name} standings, ${season.name}`} teamHref={(id) => `/teams/${id}`} />
          </div>
          <Leaders
            title="Division goal leaders"
            unit="goal"
            playerHref={(id) => `/players/${id}`}
            leaders={topBy(
              leaders.filter((l) => l.divisionId === division.id),
              "goals",
              3,
            ).map((l) => ({ playerId: l.playerId, name: l.name, photoUrl: l.photoUrl, team: l.team, count: l.goals }))}
          />
        </section>
      ))}
    </PublicFrame>
  );
}
