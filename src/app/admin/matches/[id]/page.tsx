import { notFound } from "next/navigation";
import { Crest, Jersey, PageHeading } from "@/components/league";
import { Badge, GamePassTag, MatchStatusBadge, PlayerStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader, EmptyState, KeyValue } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { TZ, fmtShort, fullName } from "@/lib/format";
import { now } from "@/lib/clock";
import { matchGamePassPlayers, matchReports, matchRosters, refereeNames } from "@/lib/queries/admin-league";
import { getMatchByGameNumber, reportOverdue } from "@/lib/queries/matches";
import { getSettings } from "@/lib/queries/season";
import { listTeams } from "@/lib/queries/teams";
import { ArchivedNotice, Crumbs, seasonFrom, withSeason, type SearchParams } from "../../_components/season";
import { ToastButton } from "../../_components/toast-button";
import { OfficialsForm } from "./officials-form";

export const metadata = { title: "Match" };

type Row = { key: string; jersey: number | string; name: string; gamePass?: boolean; suspended?: boolean; unavailable?: boolean };
function RosterList({ rows }: { rows: Row[] }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
      {rows.map((p) => (
        <div
          key={p.key}
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

function RosterBadge({ status, selected, max }: { status: "DRAFT" | "FINALIZED" | null; selected: number; max: number }) {
  if (status === "FINALIZED") return <Badge tone="ok">Finalized</Badge>;
  if (status === "DRAFT")
    return (
      <Badge tone="warn">
        Draft · {selected} / {max}
      </Badge>
    );
  return <MatchStatusBadge status="Not started" />;
}

export default async function MatchDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  const season = await seasonFrom(await searchParams);
  const m = /^\d+$/.test(id) ? await getMatchByGameNumber(season.id, Number(id)) : null;
  if (!m) notFound();
  const readOnly = season.archived;
  const home = m.homeTeam;
  const away = m.awayTeam;

  const [teams, reports, { rosters, unavailable }, passes, referees, settings] = await Promise.all([
    listTeams(season.id),
    matchReports(m.id),
    matchRosters(m.id),
    matchGamePassPlayers(m.id),
    refereeNames(),
    getSettings(season.id),
  ]);
  const captainOf = (teamId: string) => teams.find((t) => t.id === teamId)?.captains[0];
  const homeCap = captainOf(home.id) ?? `${home.name}’s captain`;
  const awayCap = captainOf(away.id) ?? `${away.name}’s captain`;

  /** Match roster for a team, plus any game-pass players registered for this match. */
  const rosterFor = (teamId: string) => {
    const roster = rosters.find((r) => r.teamId === teamId) ?? null;
    const rows: Row[] = (roster?.entries ?? []).map(({ teamRoster: tr }) => ({
      key: tr.id,
      jersey: tr.jerseyNumber ?? "—",
      name: fullName(tr.player),
      gamePass: tr.membershipType === "GAME_PASS",
      suspended: tr.player.status === "SUSPENDED",
      unavailable: unavailable.has(tr.id),
    }));
    for (const gp of passes.filter((p) => p.teamId === teamId && !rows.some((r) => r.key === p.id)))
      rows.push({ key: gp.id, jersey: gp.jerseyNumber ?? "—", name: fullName(gp.player), gamePass: true, suspended: gp.player.status === "SUSPENDED" });
    return { status: roster?.status ?? null, rows, selected: roster?.entries.length ?? 0 };
  };
  const homeRoster = rosterFor(home.id);
  const awayRoster = rosterFor(away.id);
  const homeRows = homeRoster.rows;
  const awayRows = awayRoster.rows;

  const report = m.reportStatus === "OVERDUE" || reportOverdue(m.scheduledAt, m.reportStatus) ? "OVERDUE" : m.reportStatus;
  const reportOf = (teamId: string) => reports.find((r) => r.teamId === teamId);
  const submitted = reports.filter((r) => r.status === "SUBMITTED" || r.status === "CONFIRMED").sort((a, b) => +(a.submittedAt ?? 0) - +(b.submittedAt ?? 0));
  const drafting = reports.find((r) => r.status === "DRAFT");
  const missing = [home, away].find((t) => !submitted.some((r) => r.teamId === t.id)) ?? home;
  const capOf = (teamId: string) => (teamId === home.id ? homeCap : awayCap);
  const nameOf = (teamId: string) => (teamId === home.id ? home.name : away.name);
  const reported = submitted[0];
  const reportedScore = reported && reported.homeScore != null && reported.awayScore != null ? `${reported.homeScore}–${reported.awayScore}` : m.score?.join("–");
  const date = m.scheduledAt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: TZ });

  return (
    <>
      <div className="flex flex-col gap-2">
        <Crumbs items={[["Matches", withSeason("/admin/matches", season)], [`#${m.gameNumber}`]]} />
        <PageHeading
          title={`Game #${m.gameNumber}`}
          sub={`${home.name} vs ${away.name}`}
          actions={
            <>
              <MatchStatusBadge status={m.status} />
              <ButtonLink href={`/matches/${m.gameNumber}/print`} variant="ghost" size="sm">
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
            <Crest team={home} size="lg" />
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
            <Crest team={away} size="lg" />
            <span>{away.name}</span>
          </div>
        </div>
      </Card>

      <div className="grid gap-[18px] md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader title="Details" />
          <KeyValue
            items={[
              ["Date", date],
              ["Kickoff", m.time],
              ["Field", m.field ?? "—"],
              ["Division", m.division?.name ?? home.division.name],
            ]}
          />
        </Card>
        <Card>
          <CardHeader title="Officials" />
          <OfficialsForm refs={m.refs} referees={referees} readOnly={readOnly} />
        </Card>
        <Card className="flex flex-col gap-3">
          <CardHeader title="Match report" action={<MatchStatusBadge status={report} />} className="mb-0" />
          {report === "CONFIRMED" ? (
            <p className="text-sm">Confirmed by the league office.{reportedScore ? ` Final ${reportedScore}.` : ""} Counted in the standings.</p>
          ) : report === "SUBMITTED" ? (
            <>
              <p className="text-sm">
                Submitted by {reported ? capOf(reported.teamId) : homeCap}
                {reported?.submittedAt ? ` on ${fmtShort(reported.submittedAt)}` : ""}.{reportedScore ? ` Final ${reportedScore}.` : ""}
              </p>
              <div>
                <ToastButton label="Confirm & update standings" variant="primary" message="Report confirmed. Standings updated." disabled={readOnly} />
              </div>
            </>
          ) : report === "OVERDUE" ? (
            <>
              <p className="text-sm">Due 48 hours after the match. {capOf(missing.id)} hasn’t submitted.</p>
              <div>
                <ToastButton label="Send reminder" icon="send" message={`Reminder sent to ${capOf(missing.id)}`} disabled={readOnly} />
              </div>
            </>
          ) : report === "DRAFT" ? (
            <p className="text-sm text-muted">{capOf(drafting?.teamId ?? home.id)} has started the report but hasn’t submitted it.</p>
          ) : (
            <p className="text-sm text-muted">{m.scheduledAt < now() ? "Due 48 hours after the match." : "Opens after kickoff."}</p>
          )}
          <KeyValue
            items={[home, away].map((t) => {
              const r = reportOf(t.id);
              const score = r && r.homeScore != null && r.awayScore != null ? `${r.homeScore}–${r.awayScore}` : null;
              return [
                nameOf(t.id),
                <span key={t.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <MatchStatusBadge status={r?.status ?? "NOT_STARTED"} />
                  {score ? <b>{score}</b> : null}
                  {r?.submittedAt ? <span className="text-muted">{fmtShort(r.submittedAt)}</span> : null}
                </span>,
              ];
            })}
          />
        </Card>
      </div>

      <div className="grid gap-[18px] lg:grid-cols-2">
        <section className="flex min-w-0 flex-col gap-2.5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[26px]">{home.name}</h2>
            <RosterBadge status={homeRoster.status} selected={homeRoster.selected} max={settings.maxMatchRoster} />
          </div>
          {homeRows.length ? (
            <RosterList rows={homeRows} />
          ) : (
            <EmptyState icon="list" title="No roster yet">
              {homeCap} hasn’t started this roster.
            </EmptyState>
          )}
        </section>
        <section className="flex min-w-0 flex-col gap-2.5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[26px]">{away.name}</h2>
            <RosterBadge status={awayRoster.status} selected={awayRoster.selected} max={settings.maxMatchRoster} />
          </div>
          {awayRows.length ? (
            <RosterList rows={awayRows} />
          ) : (
            <EmptyState icon="list" title="No roster yet">
              {awayCap} hasn’t started this roster.
            </EmptyState>
          )}
        </section>
      </div>
    </>
  );
}
