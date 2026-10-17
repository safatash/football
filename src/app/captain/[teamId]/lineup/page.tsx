import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { Screen } from "@/components/shell/layout";
import { FORMATIONS } from "@/lib/league-data";
import { nextMatchSquad, opponentOf, teamAccess } from "@/lib/queries/captain";
import { LineupClient } from "./lineup-client";

export const metadata = { title: "Lineup" };

export default async function CaptainLineupPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const { team, access } = await teamAccess(teamId);
  if (!team || !access) notFound();
  const { match: m, matchRoster, squad } = await nextMatchSquad(team.id, team.seasonId);

  if (!m || !matchRoster) {
    return (
      <Screen width="wide">
        <EmptyState
          icon="users"
          title={m ? "No match roster yet" : "No upcoming matches"}
          action={
            m ? (
              <ButtonLink href={`/captain/${team.id}/matches/${m.gameNumber}/roster`} variant="accent" size="sm">
                Set match roster
              </ButtonLink>
            ) : undefined
          }
        >
          {m ? `Pick the match roster for Game #${m.gameNumber} first, then place your starting XI.` : "The lineup opens once the next match is scheduled."}
        </EmptyState>
      </Screen>
    );
  }

  const formation = matchRoster.formation && FORMATIONS[matchRoster.formation] ? matchRoster.formation : "4-4-2";
  const initialSlots = Object.fromEntries(matchRoster.entries.filter((e) => e.lineupSlot).map((e) => [e.lineupSlot!, e.teamRosterId]));

  return (
    <LineupClient
      matchId={m.gameNumber}
      opponent={opponentOf(m, team.id).name}
      pool={squad}
      selected={matchRoster.entries.map((e) => e.teamRosterId)}
      formations={FORMATIONS}
      initialFormation={formation}
      initialSlots={initialSlots}
      canEdit={access !== "player"}
    />
  );
}
