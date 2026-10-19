import { PageHeading } from "@/components/league";
import { Notice } from "@/components/ui/card";
import { editableSeasons, formDivisions, formFields, formParks, formTeams } from "@/lib/queries/admin-structure";
import { ArchivedNotice, Crumbs, param, seasonFrom, withSeason, type SearchParams } from "../../_components/season";
import { MatchForm } from "../../_components/structure-forms";

export const metadata = { title: "New match" };

export default async function NewMatchPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const season = await seasonFrom(sp);
  const seasons = await editableSeasons();
  const ids = seasons.map((s) => s.id);
  const [divisions, teams, fields, parks] = await Promise.all([formDivisions(ids), formTeams(ids), formFields(), formParks()]);
  const start = seasons.find((s) => s.id === season.id)?.id ?? seasons[0]?.id ?? "";
  // From a division page: pre-select it and go back there after saving
  const fromDivision = divisions.find((d) => d.seasonId === season.id && d.code === param(sp.division));
  const backHref = fromDivision ? withSeason(`/admin/divisions/${fromDivision.code}?tab=schedule`, season) : undefined;
  return (
    <>
      <div className="flex flex-col gap-2">
        <Crumbs
          items={
            fromDivision
              ? [["Divisions", withSeason("/admin/divisions", season)], [fromDivision.name, backHref], ["New match"]]
              : [["Matches", withSeason("/admin/matches", season)], ["New match"]]
          }
        />
        <PageHeading title="New match" />
      </div>
      {season.archived ? <ArchivedNotice season={season} /> : null}
      {seasons.length ? (
        <MatchForm
          seasons={seasons}
          divisions={divisions}
          teams={teams.filter((t) => t.status !== "INACTIVE")}
          fields={fields}
          parks={parks}
          seasonId={start}
          seasonQuery={season.isActive ? "" : `season=${encodeURIComponent(season.name)}`}
          divisionId={fromDivision?.id}
          backHref={backHref}
        />
      ) : (
        <Notice tone="info">Create a season first.</Notice>
      )}
    </>
  );
}
