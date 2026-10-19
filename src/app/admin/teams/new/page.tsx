import { PageHeading } from "@/components/league";
import { Notice } from "@/components/ui/card";
import { editableSeasons, formDivisions, pickablePlayers } from "@/lib/queries/admin-structure";
import { ArchivedNotice, Crumbs, seasonFrom, withSeason, type SearchParams } from "../../_components/season";
import { TeamForm } from "../../_components/structure-forms";

export const metadata = { title: "New team" };

export default async function NewTeamPage({ searchParams }: { searchParams: SearchParams }) {
  const season = await seasonFrom(await searchParams);
  const seasons = await editableSeasons();
  const [divisions, players] = await Promise.all([formDivisions(seasons.map((s) => s.id)), pickablePlayers(season.id)]);
  const start = seasons.find((s) => s.id === season.id)?.id ?? seasons[0]?.id ?? "";
  return (
    <>
      <div className="flex flex-col gap-2">
        <Crumbs items={[["Teams", withSeason("/admin/teams", season)], ["New team"]]} />
        <PageHeading title="New team" />
      </div>
      {season.archived ? <ArchivedNotice season={season} /> : null}
      {seasons.length ? (
        <TeamForm seasons={seasons} divisions={divisions} players={players} seasonId={start} seasonQuery={season.isActive ? "" : `season=${encodeURIComponent(season.name)}`} />
      ) : (
        <Notice tone="info">Create a season first.</Notice>
      )}
    </>
  );
}
