import { DEFAULT_LINEUP, DEFAULT_MATCH_SELECTION, FORMATIONS, match, matchPool, team } from "@/lib/league-data";
import { LineupClient } from "./lineup-client";

export const metadata = { title: "Lineup" };

const MATCH_ID = 204;

export default function CaptainLineupPage() {
  const m = match(MATCH_ID)!;
  const opponent = team(m.home === "ffx" ? m.away : m.home).name;
  return (
    <LineupClient
      matchId={m.id}
      opponent={opponent}
      pool={matchPool(m.id)}
      selected={DEFAULT_MATCH_SELECTION}
      formations={FORMATIONS}
      initialFormation="4-4-2"
      initialSlots={DEFAULT_LINEUP}
    />
  );
}
