import { notFound } from "next/navigation";
import { DEFAULT_MATCH_SELECTION, MAX_MATCH_ROSTER, match, matchPool, team } from "@/lib/league-data";
import { MatchRosterClient } from "./match-roster-client";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Match roster · Game #${id}` };
}

export default async function CaptainMatchRosterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = match(id);
  if (!m) notFound();
  const opponent = team(m.home === "ffx" ? m.away : m.home);
  const pool = matchPool(m.id);
  return (
    <MatchRosterClient
      matchId={m.id}
      kickoff={`${m.date.split(",")[0]} ${m.time}`}
      opponent={opponent.name}
      pool={pool}
      initial={DEFAULT_MATCH_SELECTION.filter((j) => pool.some((p) => p.jersey === j))}
      max={MAX_MATCH_ROSTER}
    />
  );
}
