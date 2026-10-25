import { PageHeading } from "@/components/league";
import { ArchivedNotice, Crumbs, seasonFrom, withSeason, type SearchParams } from "../../_components/season";
import { ImportSchedule } from "../schedule-tools";

export const metadata = { title: "Import schedule" };

/** Admin › Matches › Import schedule (CSV). */
export default async function ImportSchedulePage({ searchParams }: { searchParams: SearchParams }) {
  const season = await seasonFrom(await searchParams);
  return (
    <>
      <div className="flex flex-col gap-2">
        <Crumbs items={[["Matches", withSeason("/admin/matches", season)], ["Import schedule"]]} />
        <PageHeading title="Import schedule" sub={`Add ${season.name} matches from a spreadsheet (CSV).`} />
      </div>
      {season.archived ? <ArchivedNotice season={season} /> : <ImportSchedule seasonId={season.id} />}
    </>
  );
}
