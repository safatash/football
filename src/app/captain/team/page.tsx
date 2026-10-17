import { Screen } from "@/components/shell/layout";
import { FFX_ROSTER } from "@/lib/league-data";
import { TeamUpdateButton } from "../team-update";
import { TeamRosterClient } from "./team-roster-client";

export const metadata = { title: "Season roster" };

export default function CaptainTeamPage() {
  return (
    <Screen width="wide">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[28px]">Season roster</h2>
          <div className="text-sm text-muted">{FFX_ROSTER.length} players · Spring 2026</div>
        </div>
        <TeamUpdateButton label="Update" size="sm" />
      </div>
      <TeamRosterClient roster={FFX_ROSTER} />
    </Screen>
  );
}
