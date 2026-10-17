import { notFound } from "next/navigation";
import { Screen } from "@/components/shell/layout";
import { nextMatchSquad, seasonName, teamAccess, teamUpdateInfo } from "@/lib/queries/captain";
import { TeamUpdateButton } from "../team-update";
import { TeamRosterClient } from "./team-roster-client";

export const metadata = { title: "Season roster" };

export default async function CaptainTeamPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const { team, access } = await teamAccess(teamId);
  if (!team || !access) notFound();
  const canEdit = access !== "player";
  const [{ match, squad, season }, seasonLabel] = await Promise.all([nextMatchSquad(team.id, team.seasonId), seasonName(team.seasonId)]);

  return (
    <Screen width="wide">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[28px]">Season roster</h2>
          <div className="text-sm text-muted">
            {season.length} players · {seasonLabel}
          </div>
        </div>
        <TeamUpdateButton label="Update" size="sm" info={teamUpdateInfo(team.id, match, squad)} disabled={!canEdit} />
      </div>
      <TeamRosterClient roster={season} gameNumber={match?.gameNumber ?? null} canEdit={canEdit} />
    </Screen>
  );
}
