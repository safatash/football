import Link from "next/link";
import { PageHeading } from "@/components/league";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, Notice } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { FilterChip } from "@/components/ui/table";
import { now } from "@/lib/clock";
import { fmtDay } from "@/lib/format";
import { addDays, assignmentsBoard, weekStartOf } from "@/lib/queries/referees";
import { Crumbs, param, type SearchParams } from "../../_components/season";
import { EmailWeekButton } from "../forms";

export const metadata = { title: "Referee assignments" };

export default async function AssignmentsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const asked = param(sp.week);
  const week = /^\d{4}-\d{2}-\d{2}$/.test(asked) ? weekStartOf(new Date(`${asked}T16:00:00Z`)) : weekStartOf(now());
  const missing = param(sp.missing) === "1";
  const board = await assignmentsBoard(week, missing);
  const href = (w: string, m: boolean) => `/admin/referees/assignments?week=${w}${m ? "&missing=1" : ""}`;
  const label = `${fmtDay(new Date(`${week}T16:00:00Z`))} – ${fmtDay(new Date(`${addDays(week, 6)}T16:00:00Z`))}`;
  const assigned = board.days.reduce((a, d) => a + d.matches.reduce((b, m) => b + m.slots.filter((s) => s.name).length, 0), 0);

  return (
    <>
      <div className="flex flex-col gap-2">
        <Crumbs items={[["Referees", "/admin/referees"], ["Assignments"]]} />
        <PageHeading
          title="Assignments"
          sub={`${label} · ${board.total} matches · ${board.openSlots} open crew slot${board.openSlots === 1 ? "" : "s"}`}
          actions={
            <>
              <ButtonLink href={href(addDays(week, -7), missing)} variant="ghost" size="sm">
                <Icon name="left" className="size-4" />
                Previous week
              </ButtonLink>
              <ButtonLink href={href(weekStartOf(now()), missing)} variant="ghost" size="sm">
                This week
              </ButtonLink>
              <ButtonLink href={href(addDays(week, 7), missing)} variant="ghost" size="sm">
                Next week
                <Icon name="right" className="size-4" />
              </ButtonLink>
              <EmailWeekButton weekStart={week} count={assigned} />
            </>
          }
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <FilterChip href={href(week, false)} active={!missing} count={board.total}>
          All matches
        </FilterChip>
        <FilterChip href={href(week, true)} active={missing} count={board.missing}>
          Missing a referee
        </FilterChip>
      </div>
      {board.missing && !missing ? <Notice tone="warn">{board.missing} match{board.missing === 1 ? " is" : "es are"} missing at least one of center, AR1 or AR2. Open slots are highlighted.</Notice> : null}

      {board.days.length ? (
        board.days.map((d) => (
          <section key={d.day} className="flex flex-col gap-2">
            <h2 className="text-[22px]">{d.label}</h2>
            <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface">
              <table className="w-full min-w-[860px] text-[14px]">
                <thead className="bg-surface-2 text-left text-xs font-bold tracking-wide text-muted uppercase">
                  <tr>
                    <th className="px-3 py-2.5">Time</th>
                    <th className="px-3 py-2.5">Field</th>
                    <th className="px-3 py-2.5">Match</th>
                    {d.matches[0].slots.map((s) => (
                      <th key={s.role} className="px-3 py-2.5">
                        {s.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {d.matches.map((m) => (
                    <tr key={m.id} className="border-t border-line align-top">
                      <td className="px-3 py-2.5 font-bold whitespace-nowrap">{m.time}</td>
                      <td className="px-3 py-2.5 text-[13px] whitespace-nowrap">{m.where}</td>
                      <td className="px-3 py-2.5">
                        <Link href={`/admin/matches/${m.gameNumber}${m.season.isActive ? "" : `?season=${encodeURIComponent(m.season.name)}`}`} className="font-bold hover:underline">
                          #{m.gameNumber} {m.homeTeam.name} vs {m.awayTeam.name}
                        </Link>
                        <div className="text-xs text-muted">{m.division?.name}</div>
                      </td>
                      {m.slots.map((s) => {
                        const needed = s.role !== "FOURTH";
                        return (
                          <td key={s.role} className={`px-3 py-2.5 whitespace-nowrap ${!s.name && needed ? "bg-bad-bg" : ""}`}>
                            {s.name ? (
                              <Link href={`/admin/referees/${s.refereeId}`} className="hover:underline">
                                {s.name}
                                {s.status === "CONFIRMED" ? <span className="ml-1 text-ok">✓</span> : null}
                              </Link>
                            ) : needed ? (
                              <Badge tone="bad">Open</Badge>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      ) : (
        <EmptyState icon="cal" title={missing ? "Every match this week has a full crew" : "No matches this week"} />
      )}
      <p className="text-[13px] text-muted">Click a match to assign officials. ✓ means the referee confirmed.</p>
    </>
  );
}
