import type { Metadata } from "next";
import { getBrand } from "@/lib/branding";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Crest } from "@/components/league";
import { Card, EmptyState } from "@/components/ui/card";
import { PageTitle, PublicFrame, RedirectNotice, SeasonTabs } from "@/components/public";
import { one, type PublicSearchParams } from "@/components/public/matches-page";
import { resolvePublicSeason } from "@/lib/queries/public";
import { loadSeasonStandings } from "@/lib/queries/standings";

export const revalidate = 60;
export async function generateMetadata(): Promise<Metadata> {
  const b = await getBrand();
  return { title: "Teams", description: `Every ${b.name} team this season, by division, with records and points.`, alternates: { canonical: "/teams" } };
}

export default async function TeamsPage({ searchParams }: { searchParams: PublicSearchParams }) {
  const sp = await searchParams;
  const { season, active, seasons } = await resolvePublicSeason(one(sp.season));
  if (!season) notFound();
  const divisions = await loadSeasonStandings(season.id);

  return (
    <PublicFrame>
      <PageTitle eyebrow={season.name} title="Teams" sub={`${divisions.reduce((n, d) => n + d.rows.length, 0)} teams in ${divisions.length} divisions.`} />
      <RedirectNotice code={one(sp.notice)} />
      <SeasonTabs seasons={seasons} current={season} href={(slug) => (slug === active?.slug ? "/teams" : `/teams?season=${slug}`)} />
      {divisions.length ? null : <EmptyState icon="shield" title={`No teams in ${season.name}`} />}
      {divisions.map(({ division, rows }) => (
        <section key={division.id} className="flex flex-col gap-2.5" aria-labelledby={`teams-${division.code}`}>
          <h2 id={`teams-${division.code}`} className="text-[24px]">
            {division.name}
          </h2>
          <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {[...rows]
              .sort((a, b) => a.team.name.localeCompare(b.team.name))
              .map((r) => (
                <li key={r.team.id}>
                  <Card className="relative flex items-center gap-3 !p-3.5 hover:bg-surface-2">
                    <Crest team={r.team} size="lg" />
                    <div className="min-w-0 flex-1">
                      <Link href={`/teams/${r.team.id}`} className="block truncate font-bold after:absolute after:inset-0 hover:underline">
                        {r.team.name}
                      </Link>
                      <span className="text-[13px] text-muted">
                        {r.w}-{r.d}-{r.l} <abbr title="wins-draws-losses" className="no-underline">W-D-L</abbr>
                      </span>
                    </div>
                    <span className="text-right">
                      <b className="font-display text-2xl leading-none font-extrabold">{r.pts}</b>
                      <span className="block text-[11px] text-muted">pts</span>
                    </span>
                  </Card>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </PublicFrame>
  );
}
