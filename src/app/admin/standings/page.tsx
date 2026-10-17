import { PageHeading } from "@/components/league";
import { EmptyState } from "@/components/ui/card";
import { Segmented } from "@/components/ui/controls";
import { listDivisions } from "@/lib/queries/admin-league";
import { loadStandings } from "@/lib/queries/standings";
import { param, seasonFrom, withSeason, type SearchParams } from "../_components/season";
import { StandingsTable } from "../_components/standings-table";

export const metadata = { title: "Standings" };

export default async function StandingsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const season = await seasonFrom(sp);
  const divisions = await listDivisions(season.id);
  const active = divisions.find((d) => d.code === param(sp.division)) ?? divisions[0];
  if (!active)
    return (
      <>
        <PageHeading title="Standings" sub={`${season.name} · 3 points for a win, 1 for a draw`} />
        <EmptyState icon="list" title="No divisions this season" />
      </>
    );
  const rows = await loadStandings(season.id, active.id);
  return (
    <>
      <PageHeading title="Standings" sub={`${season.name} · 3 points for a win, 1 for a draw`} />
      <Segmented
        label="Division"
        active={active.code}
        className="lg:max-w-[720px]"
        items={divisions.map((d) => ({ key: d.code, label: d.name, href: withSeason(`/admin/standings?division=${d.code}`, season) }))}
      />
      <StandingsTable rows={rows} linkBase="/admin/teams" href={(h) => withSeason(h, season)} />
      <p className="text-[13px] text-muted">Updated after the league office confirms each match report. Ties break on goal difference, then goals scored.</p>
    </>
  );
}
