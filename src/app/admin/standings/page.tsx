import { PageHeading } from "@/components/league";
import { Segmented } from "@/components/ui/controls";
import { DIVISIONS, type DivisionId } from "@/lib/league-data";
import { param, seasonFrom, withSeason, type SearchParams } from "../_components/season";
import { StandingsTable } from "../_components/standings-table";

export const metadata = { title: "Standings" };

export default async function StandingsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const season = seasonFrom(sp);
  const active = (DIVISIONS.find((d) => d.id === param(sp.division))?.id ?? DIVISIONS[0].id) as DivisionId;
  return (
    <>
      <PageHeading title="Standings" sub={`${season} · 3 points for a win, 1 for a draw`} />
      <Segmented
        label="Division"
        active={active}
        className="lg:max-w-[720px]"
        items={DIVISIONS.map((d) => ({ key: d.id, label: d.name, href: withSeason(`/admin/standings?division=${d.id}`, season) }))}
      />
      <StandingsTable division={active} linkBase="/admin/teams" />
      <p className="text-[13px] text-muted">Updated after the league office confirms each match report. Ties break on goal difference, then goals scored.</p>
    </>
  );
}
