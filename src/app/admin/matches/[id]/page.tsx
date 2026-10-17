import { notFound } from "next/navigation";
import { Crest, Jersey, PageHeading } from "@/components/league";
import { Badge, GamePassTag, MatchStatusBadge, PlayerStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader, EmptyState, KeyValue } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { ALX_ROSTER, DEFAULT_MATCH_SELECTION, MAX_MATCH_ROSTER, division, match, matchPool, team } from "@/lib/league-data";
import { ArchivedNotice, Crumbs, isArchived, seasonFrom, withSeason, type SearchParams } from "../../_components/season";
import { ToastButton } from "../../_components/toast-button";
import { OfficialsForm } from "./officials-form";

export const metadata = { title: "Match" };

type Row = { jersey: number; name: string; gamePass?: boolean; suspended?: boolean; unavailable?: boolean };

function RosterList({ rows }: { rows: Row[] }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
      {rows.map((p) => (
        <div
          key={`${p.jersey}-${p.name}`}
          className={`flex min-h-12 items-center gap-3 border-b border-line px-3.5 py-2 last:border-b-0 ${
            p.gamePass ? "bg-gradient-to-r from-pass-bg to-transparent to-70% shadow-[inset_3px_0_0_var(--pass)]" : ""
          }`}
        >
          <Jersey n={p.jersey} small gamePass={p.gamePass} />
          <b className="min-w-0 flex-1 text-sm">{p.name}</b>
          <span className="flex flex-wrap justify-end gap-1.5">
            {p.gamePass ? <GamePassTag /> : null}
            {p.suspended ? <PlayerStatusBadge status="Suspended" /> : null}
            {p.unavailable ? <Badge tone="warn">Unavailable</Badge> : null}
          </span>
        </div>
      ))}
    </div>
  );
}

export default async function MatchDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  const season = seasonFrom(await searchParams);
  const m = match(id);
  if (!m) notFound();
  const readOnly = isArchived(season);
  const home = team(m.home);
  const away = team(m.away);

  const homeRows: Row[] =
    m.home === "ffx"
      ? matchPool(m.id)
          .filter((p) => DEFAULT_MATCH_SELECTION.includes(p.jersey))
          .map((p) => ({ jersey: p.jersey, name: p.name, gamePass: p.gamePass, suspended: p.suspended, unavailable: p.avail === "no" }))
      : [];
  const awayRows: Row[] = m.away === "alx" ? ALX_ROSTER.map((p) => ({ jersey: p.jersey, name: p.name })) : [];

  return (
    <>
      <div className="flex flex-col gap-2">
        <Crumbs items={[["Matches", withSeason("/admin/matches", season)], [`#${m.id}`]]} />
        <PageHeading
          title={`Game #${m.id}`}
          sub={`${home.name} vs ${away.name}`}
          actions={
            <>
              <MatchStatusBadge status={m.status} />
              <ButtonLink href={`/matches/${m.id}/print`} variant="ghost" size="sm">
                <Icon name="print" className="size-4" />
                Print roster
              </ButtonLink>
            </>
          }
        />
      </div>
      <ArchivedNotice season={season} />

      <Card className="p-[22px]">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-[15px] font-bold lg:text-lg">
          <div className="flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:items-center">
            <Crest teamId={home.id} size="lg" />
            <span>{home.name}</span>
          </div>
          {m.score ? (
            <div className="font-display text-[40px] font-extrabold lg:text-[48px]">
              {m.score[0]}–{m.score[1]}
            </div>
          ) : (
            <div className="font-display text-[22px] font-extrabold text-muted">VS</div>
          )}
          <div className="flex min-w-0 flex-col items-end gap-2 text-right sm:flex-row-reverse sm:items-center">
            <Crest teamId={away.id} size="lg" />
            <span>{away.name}</span>
          </div>
        </div>
      </Card>

      <div className="grid gap-[18px] md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader title="Details" />
          <KeyValue
            items={[
              ["Date", `${m.date}, 2026`],
              ["Kickoff", m.time],
              ["Field", m.field],
              ["Division", division(m.div).name],
            ]}
          />
        </Card>
        <Card>
          <CardHeader title="Officials" />
          <OfficialsForm refs={m.refs} readOnly={readOnly} />
        </Card>
        <Card className="flex flex-col gap-3">
          <CardHeader title="Match report" action={<MatchStatusBadge status={m.report} />} className="mb-0" />
          {m.report === "Submitted" ? (
            <>
              <p className="text-sm">
                Submitted by the home captain.{m.score ? ` Final ${m.score.join("–")}.` : ""}
              </p>
              <div>
                <ToastButton label="Confirm & update standings" variant="primary" message="Report confirmed. Standings updated." disabled={readOnly} />
              </div>
            </>
          ) : m.report === "Overdue" ? (
            <>
              <p className="text-sm">Due 48 hours after the match. {home.caps[0]} hasn’t submitted.</p>
              <div>
                <ToastButton label="Send reminder" icon="send" message={`Reminder sent to ${home.caps[0]}`} disabled={readOnly} />
              </div>
            </>
          ) : m.report === "Draft" ? (
            <p className="text-sm text-muted">{home.caps[0]} has started the report but hasn’t submitted it.</p>
          ) : (
            <p className="text-sm text-muted">Opens after kickoff.</p>
          )}
        </Card>
      </div>

      <div className="grid gap-[18px] lg:grid-cols-2">
        <section className="flex min-w-0 flex-col gap-2.5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[26px]">{home.name}</h2>
            {homeRows.length ? (
              m.id === 204 ? (
                <Badge tone="warn">
                  Draft · {homeRows.length} / {MAX_MATCH_ROSTER}
                </Badge>
              ) : (
                <Badge tone="ok">Finalized</Badge>
              )
            ) : (
              <MatchStatusBadge status="Not started" />
            )}
          </div>
          {homeRows.length ? (
            <RosterList rows={homeRows} />
          ) : (
            <EmptyState icon="list" title="No roster yet">
              {home.caps[0]} hasn’t started this roster.
            </EmptyState>
          )}
        </section>
        <section className="flex min-w-0 flex-col gap-2.5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[26px]">{away.name}</h2>
            {awayRows.length ? <Badge tone="ok">Finalized</Badge> : <MatchStatusBadge status="Not started" />}
          </div>
          {awayRows.length ? (
            <RosterList rows={awayRows} />
          ) : (
            <EmptyState icon="list" title="No roster yet">
              {away.caps[0]} hasn’t started this roster.
            </EmptyState>
          )}
        </section>
      </div>
    </>
  );
}
