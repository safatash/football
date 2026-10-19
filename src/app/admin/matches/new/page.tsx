import { PageHeading } from "@/components/league";
import { Notice } from "@/components/ui/card";
import { editableSeasons, formDivisions, formFields, formTeams } from "@/lib/queries/admin-structure";
import { ArchivedNotice, Crumbs, seasonFrom, withSeason, type SearchParams } from "../../_components/season";
import { MatchForm } from "../../_components/structure-forms";

export const metadata = { title: "New match" };

export default async function NewMatchPage({ searchParams }: { searchParams: SearchParams }) {
  const season = await seasonFrom(await searchParams);
  const seasons = await editableSeasons();
  const ids = seasons.map((s) => s.id);
  const [divisions, teams, fields] = await Promise.all([formDivisions(ids), formTeams(ids), formFields()]);
  const start = seasons.find((s) => s.id === season.id)?.id ?? seasons[0]?.id ?? "";
  return (
    <>
      <div className="flex flex-col gap-2">
        <Crumbs items={[["Matches", withSeason("/admin/matches", season)], ["New match"]]} />
        <PageHeading title="New match" />
      </div>
      {season.archived ? <ArchivedNotice season={season} /> : null}
      {seasons.length ? (
        <MatchForm
          seasons={seasons}
          divisions={divisions}
          teams={teams.filter((t) => t.status !== "INACTIVE")}
          fields={fields}
          seasonId={start}
          seasonQuery={season.isActive ? "" : `season=${encodeURIComponent(season.name)}`}
        />
      ) : (
        <Notice tone="info">Create a season first.</Notice>
      )}
    </>
  );
}
