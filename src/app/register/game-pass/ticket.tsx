import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { MatchMeta, VsRow } from "@/components/league";
import { team, type Match } from "@/lib/league-data";

/** Game pass ticket for one match. */
export function PassTicket({ match: m, holder, state }: { match: Match; holder?: string; state: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[20px] border-[1.5px] border-pass bg-surface">
      <div className="flex items-center justify-between gap-3 bg-pass px-4 py-3.5 text-white">
        <span className="inline-flex items-center gap-2 font-bold">
          <Icon name="ticket" className="size-5" />
          Game pass
        </span>
        <span className="font-display text-2xl font-extrabold">Game #{m.id}</span>
      </div>
      <div className="flex flex-col gap-3.5 p-4">
        <VsRow home={{ name: team(m.home).name, color: team(m.home).color, shortName: team(m.home).ab }} away={{ name: team(m.away).name, color: team(m.away).color, shortName: team(m.away).ab }} />
        <MatchMeta date={m.date} time={m.time} field={m.field} />
        <div className="-mx-4 border-t-[1.5px] border-dashed border-line-strong" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[13.5px]">
            {holder ? <b>{holder}</b> : null}
            <span className="text-muted">
              {holder ? " · " : ""}
              {team(m.home).name} roster
            </span>
          </span>
          {state}
        </div>
      </div>
    </div>
  );
}
