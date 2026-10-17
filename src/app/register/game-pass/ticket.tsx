import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { MatchMeta, VsRow, type CrestTeam } from "@/components/league";

export type TicketMatch = { gameNumber: number; homeTeam: CrestTeam; awayTeam: CrestTeam; date: string; time: string; field: string | null };

/** Game pass ticket for one match. */
export function PassTicket({ match: m, holder, teamName, state }: { match: TicketMatch; holder?: string; teamName?: string | null; state: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[20px] border-[1.5px] border-pass bg-surface">
      <div className="flex items-center justify-between gap-3 bg-pass px-4 py-3.5 text-white">
        <span className="inline-flex items-center gap-2 font-bold">
          <Icon name="ticket" className="size-5" />
          Game pass
        </span>
        <span className="font-display text-2xl font-extrabold">Game #{m.gameNumber}</span>
      </div>
      <div className="flex flex-col gap-3.5 p-4">
        <VsRow home={m.homeTeam} away={m.awayTeam} />
        <MatchMeta date={m.date} time={m.time} field={m.field} />
        <div className="-mx-4 border-t-[1.5px] border-dashed border-line-strong" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[13.5px]">
            {holder ? <b>{holder}</b> : null}
            <span className="text-muted">
              {holder ? " · " : ""}
              {teamName ? `${teamName} roster` : "Team assigned by the league"}
            </span>
          </span>
          {state}
        </div>
      </div>
    </div>
  );
}
