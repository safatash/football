import { notFound } from "next/navigation";
import { Badge, GamePassTag } from "@/components/ui/badge";
import { Card, CardHeader, EmptyState, HeroCard, Notice, StatCard } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Jersey, MatchMeta, VsRow } from "@/components/league";
import { Screen } from "@/components/shell/layout";
import { ButtonLink } from "@/components/ui/button";
import { now } from "@/lib/clock";
import { TZ, fmtDay, fmtTime, relativeDay } from "@/lib/format";
import { gamePassMembers, nextMatchSquad, reportMatchFor, teamAccess, teamUpdateInfo } from "@/lib/queries/captain";
import { REPORT_GRACE_MS, reportOverdue } from "@/lib/queries/matches";
import { getSettings } from "@/lib/queries/season";
import { AvailText, jerseyLabel } from "./roster-helpers";
import { TeamUpdateButton } from "./team-update";

export const metadata = { title: "Captain overview" };

/** Match rosters are due an hour before kickoff so the referee has them at check-in. */
const ROSTER_DEADLINE_MS = 3600_000;

function reportCard(r: Awaited<ReturnType<typeof reportMatchFor>>) {
  if (!r) return { value: "—", note: "No completed matches yet", tone: undefined };
  if (r.status === "CONFIRMED") return { value: "Confirmed", note: "Counted in the standings", tone: "ok" as const };
  if (r.status === "SUBMITTED") return { value: "Submitted", note: "Waiting for the league office", tone: "ok" as const };
  const due = new Date(r.match.scheduledAt.getTime() + REPORT_GRACE_MS);
  return reportOverdue(r.match.scheduledAt, r.status)
    ? { value: "Overdue", note: `Was due ${fmtDay(due)}`, tone: "bad" as const }
    : { value: "Due", note: `Submit by ${fmtDay(due)}`, tone: "bad" as const };
}

export default async function CaptainOverviewPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const { team, access } = await teamAccess(teamId);
  if (!team || !access) notFound();
  const canEdit = access !== "player";
  const base = `/captain/${team.id}`;

  const [{ match: m, matchRoster, squad, season }, report, passPlayers, settings] = await Promise.all([
    nextMatchSquad(team.id, team.seasonId),
    reportMatchFor(team.id, team.seasonId),
    gamePassMembers(team.id),
    getSettings(team.seasonId),
  ]);

  const pool = squad;
  const available = pool.filter((p) => p.avail === "yes" && !p.suspended).length;
  const noReply = pool.filter((p) => p.avail === "maybe" && !p.suspended).length;
  const out = pool.filter((p) => p.avail === "no" || p.suspended).length;
  const selected = matchRoster?.entries.length ?? 0;
  const placed = matchRoster?.entries.filter((e) => e.lineupSlot).length ?? 0;
  const posCount = (["GK", "DEF", "MID", "FWD"] as const).map((pos) => [pos, season.filter((p) => p.pos === pos).length] as const);
  const flagged = season.filter((p) => p.avail !== "yes" || p.suspended);
  const activePasses = passPlayers.filter((p) => p.active).length;
  const rosterHref = m ? `${base}/matches/${m.gameNumber}/roster` : undefined;
  const rep = reportCard(report);
  const deadline = m ? new Date(m.scheduledAt.getTime() - ROSTER_DEADLINE_MS) : null;

  return (
    <Screen width="wide" className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
      {m ? (
        <HeroCard className="flex flex-col gap-3.5 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <span className="eyebrow !text-white/75">Next match · Game #{m.gameNumber}</span>
            <Badge tone="warn">{relativeDay(m.scheduledAt, now())}</Badge>
          </div>
          <VsRow home={m.homeTeam} away={m.awayTeam} onDark />
          <MatchMeta
            onDark
            date={`${m.date}, ${m.time}`}
            field={m.field}
            extra={
              m.refs[0] ? (
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="whistle" className="size-[15px]" />
                  {m.refs[0]}
                </span>
              ) : null
            }
          />
          <div className="flex flex-wrap gap-2.5">
            <ButtonLink href={rosterHref!} variant="accent" size="sm">
              Set match roster
              <Icon name="right" className="size-4" />
            </ButtonLink>
            <ButtonLink href={`/matches/${m.gameNumber}/print`} size="sm" className="!bg-white !text-[#0F3D2E]">
              <Icon name="print" className="size-4" />
              Print game roster
            </ButtonLink>
          </div>
        </HeroCard>
      ) : (
        <div className="lg:col-span-2">
          <EmptyState icon="cal" title="No upcoming matches">
            The next {team.name} match shows up here once the schedule is posted.
          </EmptyState>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:col-span-2 lg:grid-cols-4">
        <StatCard href={rosterHref} label="Available" value={m ? available : "—"} suffix={m ? `/${pool.length}` : undefined} note={m ? `${noReply} no reply · ${out} out` : "No match scheduled"} />
        <StatCard
          href={rosterHref}
          label="Match roster"
          value={selected}
          suffix={`/${settings.maxMatchRoster}`}
          note={!matchRoster ? "Not started" : matchRoster.status === "FINALIZED" ? "Finalized" : "Draft · not finalized"}
        />
        <StatCard href={`${base}/lineup`} label="Lineup" value={matchRoster?.formation ?? "—"} note={`${placed}/11 placed`} />
        <StatCard
          href={report ? `${base}/matches/${report.match.gameNumber}/report` : undefined}
          label={report ? `Report · Game #${report.match.gameNumber}` : "Match report"}
          value={rep.value}
          tone={rep.tone}
          note={rep.note}
        />
      </div>

      {m && deadline && matchRoster?.status !== "FINALIZED" ? (
        <Notice
          tone="warn"
          title={`Finalize your match roster by ${fmtTime(deadline)} ${deadline.toLocaleDateString("en-US", { weekday: "long", timeZone: TZ })}`}
          className="lg:col-span-2"
        >
          so the referee gets it at check-in.
        </Notice>
      ) : null}

      <Card>
        <CardHeader title="Game pass watch" action={<GamePassTag>{activePasses} active</GamePassTag>} />
        {passPlayers.length ? (
          <div className="overflow-hidden rounded-[var(--radius-field)] border border-line">
            {passPlayers.map((p) => (
              <div
                key={p.id}
                className={`flex min-h-[60px] items-center gap-3 border-b border-line px-3.5 py-2.5 last:border-b-0 ${
                  p.active ? "bg-[linear-gradient(90deg,var(--pass-bg),transparent_70%)] shadow-[inset_3px_0_0_var(--pass)]" : "opacity-60"
                }`}
              >
                <Jersey n={jerseyLabel(p.jersey)} gamePass />
                <div className="min-w-0 flex-1">
                  <b className="block text-sm">{p.name}</b>
                  <span className="text-xs text-muted">
                    {p.active ? `${p.pos} · Game #${p.gameNumber} only` : `Game #${p.gameNumber} · removed from your pool`}
                  </span>
                </div>
                {p.active ? <Badge tone="ok">Active for match day</Badge> : <Badge tone="bad">Expired</Badge>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No game-pass players have joined this team yet.</p>
        )}
        <p className="mt-2 text-xs text-muted">Game-pass players drop off automatically when their match ends.</p>
      </Card>

      <Card>
        <CardHeader
          title="Roster snapshot"
          action={
            <ButtonLink href={`${base}/team`} variant="link" size="sm">
              Manage
            </ButtonLink>
          }
        />
        <div className="grid grid-cols-4 gap-2">
          {posCount.map(([pos, n]) => (
            <div key={pos} className="rounded-[var(--radius-field)] bg-surface-2 px-2 py-2.5 text-center">
              <b className="block font-display text-[26px] leading-none font-extrabold">{n}</b>
              <span className="text-xs text-muted">{pos}</span>
            </div>
          ))}
        </div>
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {flagged.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span>
                <b>{p.name}</b> {p.jersey != null ? <span className="text-muted">#{p.jersey}</span> : null}
              </span>
              <AvailText p={p} />
            </li>
          ))}
        </ul>
      </Card>

      <div className="lg:col-start-2">
        <TeamUpdateButton block teamId={team.id} info={teamUpdateInfo(team.id, m, squad)} disabled={!canEdit} />
      </div>
    </Screen>
  );
}
