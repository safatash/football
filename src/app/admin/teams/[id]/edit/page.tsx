import { notFound } from "next/navigation";
import { PageHeading } from "@/components/league";
import { getTeam, teamRoster } from "@/lib/queries/teams";
import { editableSeasons, formDivisions, pickablePlayers } from "@/lib/queries/admin-structure";
import { ArchivedNotice, Crumbs, seasonFrom, withSeason, type SearchParams } from "../../../_components/season";
import { DeleteTeamButton, RosterManager, TeamForm } from "../../../_components/structure-forms";

export const metadata = { title: "Edit team" };

export default async function EditTeamPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const season = await seasonFrom(sp);
  const team = await getTeam(id, season.id);
  if (!team) notFound();
  const [seasons, roster, players] = await Promise.all([editableSeasons(), teamRoster(team.id), pickablePlayers(season.id)]);
  const divisions = await formDivisions([team.seasonId]);
  const back = withSeason("/admin/teams", season);
  const seasonQuery = season.isActive ? "" : `season=${encodeURIComponent(season.name)}`;
  return (
    <>
      <div className="flex flex-col gap-2">
        <Crumbs items={[["Teams", back], [team.name, withSeason(`/admin/teams/${team.code ?? team.id}`, season)], ["Edit"]]} />
        <PageHeading title={`Edit ${team.name}`} sub={`${team.division.name} · ${season.name}`} actions={season.archived ? null : <DeleteTeamButton id={team.id} name={team.name} back={back} />} />
      </div>
      {season.archived ? (
        <ArchivedNotice season={season} />
      ) : (
        <div className="grid gap-[18px] lg:grid-cols-2 lg:items-start">
          <TeamForm
            seasons={seasons.length ? seasons : [{ id: team.seasonId, name: season.name }]}
            divisions={divisions}
            players={players}
            seasonId={team.seasonId}
            seasonQuery={seasonQuery}
            team={{
              id: team.id,
              seasonId: team.seasonId,
              divisionId: team.division.id,
              name: team.name,
              status: team.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
              shortName: team.shortName ?? "",
              color: team.color ?? "",
              homeField: team.homeField ?? "",
            }}
          />
          <RosterManager
            teamId={team.id}
            players={players}
            roster={roster.map((r) => ({ playerId: r.player.id, name: r.name, jersey: r.jerseyNumber, captain: r.isCaptain, position: r.player.position }))}
          />
        </div>
      )}
    </>
  );
}
