import { notFound } from "next/navigation";
import { TZ, fmtTime } from "@/lib/format";
import { matchRosterFor, opponentOf, squadFor, teamAccess, teamMatch } from "@/lib/queries/captain";
import { getSettings } from "@/lib/queries/season";
import { matchPool } from "@/lib/queries/teams";
import { MatchRosterClient } from "./match-roster-client";

export async function generateMetadata({ params }: { params: Promise<{ gameNumber: string }> }) {
  const { gameNumber } = await params;
  return { title: `Match roster · Game #${gameNumber}` };
}

const weekday = (d: Date) => d.toLocaleDateString("en-US", { weekday: "short", timeZone: TZ });

export default async function CaptainMatchRosterPage({ params }: { params: Promise<{ teamId: string; gameNumber: string }> }) {
  const { teamId, gameNumber } = await params;
  const { team, access } = await teamAccess(teamId);
  if (!team || !access) notFound();
  const m = await teamMatch(team.id, team.seasonId, gameNumber);
  if (!m) notFound();

  const [members, matchRoster, settings] = await Promise.all([matchPool(team.id, m.id), matchRosterFor(m.id, team.id), getSettings(team.seasonId)]);
  const slots = new Map(matchRoster?.entries.map((e) => [e.teamRosterId, e.lineupSlot]) ?? []);
  const pool = await squadFor(members, m.id, slots);
  const inPool = new Set(pool.map((p) => p.id));

  return (
    <MatchRosterClient
      teamId={team.id}
      matchDbId={m.id}
      matchId={m.gameNumber}
      kickoff={`${weekday(m.scheduledAt)} ${m.time}`}
      opponent={opponentOf(m, team.id).name}
      pool={pool}
      initial={matchRoster?.entries.map((e) => e.teamRosterId).filter((id) => inPool.has(id)) ?? []}
      max={settings.maxMatchRoster}
      finalized={
        matchRoster?.status === "FINALIZED" ? (matchRoster.finalizedAt ? `${weekday(matchRoster.finalizedAt)} ${fmtTime(matchRoster.finalizedAt)}` : "earlier") : null
      }
      canEdit={access !== "player"}
    />
  );
}
