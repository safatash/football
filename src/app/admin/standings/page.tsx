import { PageHeading } from "@/components/league";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { standingsByDivision } from "@/lib/queries/standings";
import { DivisionFilter } from "../_components/division-filter";
import { DivisionStandings } from "../_components/division-standings";
import { param, seasonFrom, withSeason, type SearchParams } from "../_components/season";

export const metadata = { title: "Standings" };

export default async function StandingsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const season = await seasonFrom(sp);
  const all = await standingsByDivision(season.id);
  // A division code from another season (after switching seasons) falls back to all divisions
  const picked = all.find((s) => s.division.code === param(sp.division));
  const shown = picked ? [picked] : all;
  const sub = `${season.name} · 3 points for a win, 1 for a draw`;

  if (!all.length)
    return (
      <>
        <PageHeading title="Standings" sub={sub} />
        <EmptyState
          icon="list"
          title={`No divisions in ${season.name}`}
          action={
            season.archived ? undefined : (
              <ButtonLink href={withSeason("/admin/divisions/new", season)} variant="primary" size="sm">
                <Icon name="plus" className="size-4" />
                New division
              </ButtonLink>
            )
          }
        >
          Standings are kept per division. Add one under Divisions › New division.
        </EmptyState>
      </>
    );

  return (
    <>
      <PageHeading title="Standings" sub={sub} actions={<DivisionFilter divisions={all.map((s) => s.division)} value={picked?.division.code ?? ""} />} />
      <div className="flex flex-col gap-8">
        {shown.map((s) => (
          <DivisionStandings key={s.division.id} standings={s} season={season} compact={!picked} />
        ))}
      </div>
      <p className="text-[13px] text-muted">Updated after the league office confirms each match report. Ties break on goal difference, then goals scored.</p>
    </>
  );
}
