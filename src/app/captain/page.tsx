import { Badge, GamePassTag } from "@/components/ui/badge";
import { Card, CardHeader, HeroCard, Notice, StatCard } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Jersey, MatchMeta, VsRow, vsFor } from "@/components/league";
import { Screen } from "@/components/shell/layout";
import { ButtonLink } from "@/components/ui/button";
import {
  DEFAULT_LINEUP,
  DEFAULT_MATCH_SELECTION,
  FFX_ROSTER,
  GAME_PASS_PLAYERS,
  MAX_MATCH_ROSTER,
  match,
  matchPool,
} from "@/lib/league-data";
import { AvailText } from "./roster-helpers";
import { TeamUpdateButton } from "./team-update";

export const metadata = { title: "Captain overview" };

const NEXT_MATCH = 204;
const REPORT_MATCH = 203;

export default function CaptainOverviewPage() {
  const m = match(NEXT_MATCH)!;
  const pool = matchPool(NEXT_MATCH);
  const available = pool.filter((p) => p.avail === "yes" && !p.suspended).length;
  const noReply = pool.filter((p) => p.avail === "maybe" && !p.suspended).length;
  const out = pool.filter((p) => p.avail === "no" || p.suspended).length;
  const placed = Object.values(DEFAULT_LINEUP).filter(Boolean).length;
  const posCount = (["GK", "DEF", "MID", "FWD"] as const).map((pos) => [pos, FFX_ROSTER.filter((p) => p.pos === pos).length] as const);
  const flagged = FFX_ROSTER.filter((p) => p.avail !== "yes" || p.suspended);
  const activePasses = GAME_PASS_PLAYERS.filter((p) => p.state === "Active").length;

  return (
    <Screen width="wide" className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
      <HeroCard className="flex flex-col gap-3.5 lg:col-span-2">
        <div className="flex items-center justify-between gap-3">
          <span className="eyebrow !text-white/75">Next match · Game #{m.id}</span>
          <Badge tone="warn">Tomorrow</Badge>
        </div>
        <VsRow {...vsFor(m)} onDark />
        <MatchMeta
          onDark
          date={`${m.date}, ${m.time}`}
          field={m.field}
          extra={
            <span className="inline-flex items-center gap-1.5">
              <Icon name="whistle" className="size-[15px]" />
              {m.refs[0]}
            </span>
          }
        />
        <div className="flex flex-wrap gap-2.5">
          <ButtonLink href={`/captain/matches/${m.id}/roster`} variant="accent" size="sm">
            Set match roster
            <Icon name="right" className="size-4" />
          </ButtonLink>
          <ButtonLink href={`/matches/${m.id}/print`} size="sm" className="!bg-white !text-[#0F3D2E]">
            <Icon name="print" className="size-4" />
            Print game roster
          </ButtonLink>
        </div>
      </HeroCard>

      <div className="grid grid-cols-2 gap-3 lg:col-span-2 lg:grid-cols-4">
        <StatCard href={`/captain/matches/${m.id}/roster`} label="Available" value={available} suffix={`/${pool.length}`} note={`${noReply} no reply · ${out} out`} />
        <StatCard
          href={`/captain/matches/${m.id}/roster`}
          label="Match roster"
          value={DEFAULT_MATCH_SELECTION.length}
          suffix={`/${MAX_MATCH_ROSTER}`}
          note="Draft · not finalized"
        />
        <StatCard href="/captain/lineup" label="Lineup" value="4-4-2" note={`${placed}/11 placed`} />
        <StatCard href={`/captain/matches/${REPORT_MATCH}/report`} label={`Report · Game #${REPORT_MATCH}`} value="Due" tone="bad" note="Submit by Mon, May 18" />
      </div>

      <Notice tone="warn" title="Finalize your match roster by 8:00 AM Sunday" className="lg:col-span-2">
        so the referee gets it at check-in.
      </Notice>

      <Card>
        <CardHeader title="Game pass watch" action={<GamePassTag>{activePasses} active</GamePassTag>} />
        <div className="overflow-hidden rounded-[var(--radius-field)] border border-line">
          {GAME_PASS_PLAYERS.map((p) => {
            const active = p.state === "Active";
            return (
              <div
                key={p.jersey}
                className={`flex min-h-[60px] items-center gap-3 border-b border-line px-3.5 py-2.5 last:border-b-0 ${
                  active ? "bg-[linear-gradient(90deg,var(--pass-bg),transparent_70%)] shadow-[inset_3px_0_0_var(--pass)]" : "opacity-60"
                }`}
              >
                <Jersey n={p.jersey} gamePass />
                <div className="min-w-0 flex-1">
                  <b className="block text-sm">{p.name}</b>
                  <span className="text-xs text-muted">
                    {active ? `${p.pos} · Game #${p.matchId} only` : `Game #${p.matchId} · removed from your pool`}
                  </span>
                </div>
                {active ? <Badge tone="ok">Active for match day</Badge> : <Badge tone="bad">Expired</Badge>}
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted">Game-pass players drop off automatically when their match ends.</p>
      </Card>

      <Card>
        <CardHeader
          title="Roster snapshot"
          action={
            <ButtonLink href="/captain/team" variant="link" size="sm">
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
            <li key={p.jersey} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span>
                <b>{p.name}</b> <span className="text-muted">#{p.jersey}</span>
              </span>
              <AvailText p={p} />
            </li>
          ))}
        </ul>
      </Card>

      <div className="lg:col-start-2">
        <TeamUpdateButton block />
      </div>
    </Screen>
  );
}
