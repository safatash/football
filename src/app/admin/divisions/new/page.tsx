import { PageHeading } from "@/components/league";
import { ArchivedNotice, Crumbs, seasonFrom, withSeason, type SearchParams } from "../../_components/season";
import { DivisionForm } from "../../_components/structure-forms";

export const metadata = { title: "New division" };

export default async function NewDivisionPage({ searchParams }: { searchParams: SearchParams }) {
  const season = await seasonFrom(await searchParams);
  return (
    <>
      <div className="flex flex-col gap-2">
        <Crumbs items={[["Divisions", withSeason("/admin/divisions", season)], ["New division"]]} />
        <PageHeading title="New division" sub={season.name} />
      </div>
      {season.archived ? <ArchivedNotice season={season} /> : <DivisionForm seasonId={season.id} seasonQuery={season.isActive ? "" : `season=${encodeURIComponent(season.name)}`} />}
    </>
  );
}
