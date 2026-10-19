import Link from "next/link";
import { EmptyState } from "@/components/ui/card";
import type { DivisionStandings as Standings } from "@/lib/queries/standings";
import { withSeason, type AdminSeason } from "./season";
import { StandingsTable } from "./standings-table";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * One division's standings: heading (name, teams, completed matches, "View division") and the
 * table, or an empty state before the first confirmed result. Used by the Standings page and the
 * division page so they always match.
 */
export function DivisionStandings({ standings, season, compact, heading = "division" }: { standings: Standings; season: AdminSeason; compact?: boolean; heading?: "division" | "standings" }) {
  const { division, rows, teams, completed } = standings;
  return (
    <section className="flex min-w-0 flex-col gap-2.5" aria-labelledby={`standings-${division.code}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 id={`standings-${division.code}`} className={compact ? "text-[22px]" : "text-[26px]"}>
            {heading === "division" ? division.name : "Standings"}
          </h2>
          <span className="text-[13px] text-muted">
            {plural(teams, "team")} · Based on {plural(completed, "completed match", "completed matches")}
          </span>
        </div>
        {heading === "division" ? (
          <Link href={withSeason(`/admin/divisions/${division.code}`, season)} className="text-[13.5px] font-bold text-pitch-2 underline underline-offset-4 dark:text-lime">
            View division
          </Link>
        ) : null}
      </div>
      {completed ? (
        <StandingsTable rows={rows} compact={compact} linkBase="/admin/teams" href={(h) => withSeason(h, season)} />
      ) : (
        <EmptyState icon="list" title="No results yet">
          {teams ? "Standings appear after the first confirmed match report." : "This division has no teams yet."}
        </EmptyState>
      )}
    </section>
  );
}
