import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { AppFrame } from "@/components/shell/app-frame";
import { CaptainTabs } from "@/components/shell/app-nav";
import { TeamHeader } from "@/components/shell/layout";
import { nextTeamMatch, reportMatchFor, seasonName, teamAccess } from "@/lib/queries/captain";
import { getTeam } from "@/lib/queries/teams";
import { requireUser } from "@/lib/session";
import { captainedTeams } from "@/lib/team-access";
import { TeamSwitcher } from "./team-switcher";

export async function generateMetadata({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const team = await getTeam(teamId);
  return { title: team ? `Captain · ${team.name}` : "Captain" };
}

const ROLE = { captain: "Captain", admin: "Admin", player: "Player" } as const;

export default async function CaptainTeamLayout({ children, params }: { children: ReactNode; params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const session = await requireUser(`/captain/${teamId}`);
  const { team, access } = await teamAccess(teamId);
  if (!team || !access) notFound();

  const [season, captained, next, report] = await Promise.all([
    seasonName(team.seasonId),
    captainedTeams(session.user.playerId),
    nextTeamMatch(team.id, team.seasonId),
    reportMatchFor(team.id, team.seasonId),
  ]);

  return (
    <AppFrame name={session.user.name ?? session.user.email ?? "Player"} isCaptain={captained.length > 0} season={season}>
      <TeamHeader team={team} sub={`${team.division.name} · ${season}`} role={ROLE[access]}>
        {captained.length > 1 ? (
          <TeamSwitcher teams={[...(captained.some((t) => t.id === team.id) ? [] : [team]), ...captained].map((t) => ({ id: t.id, name: t.name }))} current={team.id} />
        ) : null}
      </TeamHeader>
      <CaptainTabs base={`/captain/${team.id}`} matchNumber={next?.gameNumber} reportNumber={report?.match.gameNumber} />
      {children}
    </AppFrame>
  );
}
