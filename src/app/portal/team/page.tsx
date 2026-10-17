import { MatchStatusBadge, RoleTag } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { Segmented } from "@/components/ui/controls";
import { Icon } from "@/components/ui/icon";
import { Avatar, MatchMeta, PosTag, VsRow } from "@/components/league";
import { AppBar, Screen, TeamHeader } from "@/components/shell/layout";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { AccessPanel } from "../access-panel";
import { fmtShort, fmtTime } from "../format";
import { AvailabilityButtons } from "../portal-client";

export const metadata = { title: "My team" };

async function teamMatches(teamId: string) {
  try {
    const matches = await prisma.match.findMany({
      where: { OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }], status: { not: "CANCELLED" } },
      include: { homeTeam: true, awayTeam: true },
      orderBy: { scheduledAt: "asc" },
    });
    const now = Date.now();
    const next = matches.find((m) => m.status === "SCHEDULED" && m.scheduledAt.getTime() >= now);
    return { matches, next };
  } catch {
    return { matches: [], next: undefined };
  }
}

export default async function PlayerTeamPage({ searchParams }: { searchParams: Promise<{ team?: string }> }) {
  const { team: teamParam } = await searchParams;
  const session = await requireUser("/portal/team");
  const playerId = session.user.playerId;

  const memberships = playerId
    ? await prisma.teamRoster.findMany({
        where: { playerId, leftAt: null, membershipType: "SEASONAL" },
        include: {
          team: {
            include: {
              division: true,
              season: true,
              roster: {
                where: { leftAt: null, membershipType: "SEASONAL" },
                include: { player: { select: { id: true, firstName: true, lastName: true, position: true } } },
                orderBy: { joinedAt: "asc" },
              },
            },
          },
        },
        orderBy: { joinedAt: "asc" },
      })
    : [];

  const selected = memberships.find((m) => m.id === teamParam) ?? memberships.find((m) => !m.isCaptain) ?? memberships[0];

  if (!selected) {
    return (
      <>
        <AppBar title="My team" width="wide" />
        <Screen width="wide">
          <EmptyState
            icon="users"
            title="You’re not on a team yet"
            action={
              <ButtonLink href="/portal" variant="ghost" size="sm">
                Back to dashboard
              </ButtonLink>
            }
          >
            Once the league office places you on a team, its roster and schedule show up here.
          </EmptyState>
        </Screen>
      </>
    );
  }

  const t = selected.team;
  const roster = t.roster;
  const captains = roster.filter((r) => r.isCaptain).map((r) => `${r.player.firstName} ${r.player.lastName}`);
  const { matches, next } = await teamMatches(t.id);

  return (
    <>
      <TeamHeader name={t.name} sub={`${t.division.name} · ${t.season.name}`} role={selected.isCaptain ? "Captain" : "Player"} />
      <Screen width="wide" className="lg:block lg:columns-2 lg:gap-6 lg:[&>*]:mb-5 [&>*]:break-inside-avoid">
        {memberships.length > 1 ? (
          <Segmented
            label="Switch team"
            className="lg:[column-span:all]"
            active={selected.id}
            items={memberships.map((m) => ({ key: m.id, href: `/portal/team?team=${m.id}`, label: m.team.name }))}
          />
        ) : null}

        <AccessPanel teamName={t.name} isCaptain={selected.isCaptain} captainNames={captains} requestPending={selected.captainRequest && !selected.isCaptain} />
        {selected.isCaptain ? (
          <ButtonLink href="/captain" block>
            Open captain tools
            <Icon name="right" className="size-4" />
          </ButtonLink>
        ) : null}

        {next ? (
          <Card className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <span className="eyebrow">Next match</span>
              <MatchStatusBadge status={next.status} />
            </div>
            <VsRow home={{ name: next.homeTeam.name }} away={{ name: next.awayTeam.name }} />
            <MatchMeta date={fmtShort(next.scheduledAt)} time={fmtTime(next.startTime ?? next.scheduledAt)} field={[next.location, next.field].filter(Boolean).join(" ") || null} />
            <AvailabilityButtons onDark={false} />
            <ButtonLink href={`/matches/${next.id}/print`} variant="ghost" size="sm">
              <Icon name="print" className="size-4" />
              Print game roster
            </ButtonLink>
          </Card>
        ) : (
          <EmptyState icon="cal" title="No upcoming matches">
            The next match shows up here once the schedule is posted.
          </EmptyState>
        )}

        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xl">Roster</h3>
            <span className="text-sm text-muted">{roster.length} players</span>
          </div>
          {roster.length ? (
            <ul className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
              {roster.map((r) => {
                const name = `${r.player.firstName} ${r.player.lastName}`;
                return (
                  <li key={r.id} className="flex min-h-[60px] items-center gap-3 border-b border-line px-3.5 py-2.5 last:border-b-0">
                    <Avatar name={name} />
                    <b className="min-w-0 flex-1 truncate text-sm">
                      {name}
                      {r.player.id === playerId ? <span className="font-normal text-muted"> (you)</span> : null}
                    </b>
                    {r.player.position ? <PosTag pos={r.player.position} /> : null}
                    {r.isCaptain ? <RoleTag role="Captain" /> : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted">The roster hasn’t been posted yet.</p>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-xl">Schedule</h3>
          {matches.length ? (
            <ul className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
              {matches.map((m) => {
                const home = m.homeTeamId === t.id;
                const opp = home ? m.awayTeam.name : m.homeTeam.name;
                const played = m.status === "COMPLETED" && m.homeScore !== null && m.awayScore !== null;
                return (
                  <li key={m.id} className="flex min-h-[60px] items-center gap-3 border-b border-line px-3.5 py-2.5 last:border-b-0">
                    <b className="w-[52px] shrink-0 text-sm">{fmtShort(m.scheduledAt)}</b>
                    <div className="min-w-0 flex-1 text-sm">
                      <b>
                        {home ? "vs" : "at"} {opp}
                      </b>
                      <div className="text-xs text-muted">
                        {fmtTime(m.startTime ?? m.scheduledAt)}
                        {m.field ? ` · ${m.field}` : ""}
                      </div>
                    </div>
                    {played ? (
                      <span className="font-display text-lg font-extrabold">
                        {m.homeScore}–{m.awayScore}
                      </span>
                    ) : (
                      <MatchStatusBadge status={m.status} />
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted">No matches scheduled yet.</p>
          )}
        </section>
      </Screen>
    </>
  );
}
