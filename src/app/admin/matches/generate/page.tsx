import { PageHeading } from "@/components/league";
import { db } from "@/lib/db";
import { isoDate } from "@/lib/format";
import { ArchivedNotice, Crumbs, seasonFrom, withSeason, type SearchParams } from "../../_components/season";
import { GenerateSchedule } from "../schedule-tools";

export const metadata = { title: "Generate schedule" };

/** Admin › Matches › Generate schedule (round robin from field availability and team blackouts). */
export default async function GenerateSchedulePage({ searchParams }: { searchParams: SearchParams }) {
  const season = await seasonFrom(await searchParams);
  const [divisions, fieldsWithTimes] = await Promise.all([
    db.division.findMany({ where: { seasonId: season.id }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, _count: { select: { teams: { where: { status: { not: "INACTIVE" } } } } } } }),
    db.field.count({ where: { active: true, availability: { some: { OR: [{ seasonId: null }, { seasonId: season.id }] } } } }),
  ]);
  return (
    <>
      <div className="flex flex-col gap-2">
        <Crumbs items={[["Matches", withSeason("/admin/matches", season)], ["Generate schedule"]]} />
        <PageHeading title="Generate schedule" sub={`${season.name}: a round robin for the divisions you pick, on your fields’ weekly times. Teams never play on their blackout dates.`} />
      </div>
      {season.archived ? (
        <ArchivedNotice season={season} />
      ) : (
        <GenerateSchedule
          seasonId={season.id}
          divisions={divisions.map((d) => ({ id: d.id, name: d.name, teams: d._count.teams }))}
          defaults={{ start: isoDate(season.startDate), end: isoDate(season.endDate) }}
          fieldsWithTimes={fieldsWithTimes}
        />
      )}
    </>
  );
}
