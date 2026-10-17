import { Badge, GamePassStatusBadge, PaymentBadge, RegistrationBadge, RoleTag } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, EmptyState, HeroCard, Notice } from "@/components/ui/card";
import { Segmented } from "@/components/ui/controls";
import { Icon } from "@/components/ui/icon";
import { Crest, MatchMeta, VsRow } from "@/components/league";
import { AppBar, Screen } from "@/components/shell/layout";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { now } from "@/lib/clock";
import { TZ, fmtDay, fmtTime, money, relativeDay } from "@/lib/format";
import { nextMatchFor } from "@/lib/queries/matches";
import { requireUser } from "@/lib/session";
import { AccessPanel } from "./access-panel";
import { AvailabilityButtons, type Choice } from "./portal-client";

export const metadata = { title: "Dashboard" };

const REG_TYPE: Record<string, string> = {
  NEW_PLAYER: "New player",
  RETURNING_PLAYER: "Returning player",
  ADDITIONAL_TEAM: "Additional team",
};

const span = "lg:[column-span:all]";

async function teamRecord(teamId: string) {
  try {
    const [played, players] = await Promise.all([
      prisma.match.findMany({
        where: { status: "COMPLETED", homeScore: { not: null }, awayScore: { not: null }, OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
        select: { homeTeamId: true, homeScore: true, awayScore: true },
      }),
      prisma.teamRoster.count({ where: { teamId, leftAt: null, membershipType: "SEASONAL" } }),
    ]);
    let w = 0,
      d = 0,
      l = 0;
    for (const m of played) {
      const [us, them] = m.homeTeamId === teamId ? [m.homeScore!, m.awayScore!] : [m.awayScore!, m.homeScore!];
      if (us > them) w++;
      else if (us === them) d++;
      else l++;
    }
    return { w, d, l, points: w * 3 + d, players };
  } catch {
    return null;
  }
}

/** The player's saved answer for a match, if any. */
async function myAvailability(teamRosterId: string, matchId: string): Promise<Choice | null> {
  const row = await prisma.matchAvailability.findUnique({ where: { matchId_teamRosterId: { matchId, teamRosterId } }, select: { status: true } });
  return row?.status === "AVAILABLE" ? "yes" : row?.status === "UNAVAILABLE" ? "no" : null;
}

export default async function PlayerDashboardPage({ searchParams }: { searchParams: Promise<{ team?: string; denied?: string; notice?: string }> }) {
  const { team: teamParam, denied, notice } = await searchParams;
  const session = await requireUser("/portal");
  // League-office accounts without a player profile land in the office.
  if (!session.user.playerId && session.user.isAdmin) redirect("/admin");
  const today = now().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: TZ });

  const player = session.user.playerId
    ? await prisma.player.findUnique({
        where: { id: session.user.playerId },
        include: {
          user: true,
          teamMemberships: {
            where: { leftAt: null }, // Only active memberships
            include: {
              team: {
                include: {
                  division: true,
                  season: true,
                  roster: { where: { isCaptain: true, leftAt: null }, include: { player: { select: { firstName: true, lastName: true } } } },
                },
              },
            },
            orderBy: { joinedAt: "asc" },
          },
          registrations: {
            orderBy: { submittedAt: "desc" },
            take: 1,
            include: { season: true },
          },
          gamePasses: {
            include: { match: { include: { homeTeam: true, awayTeam: true } } },
            orderBy: { createdAt: "desc" },
          },
        },
      })
    : null;

  const firstName = player?.firstName ?? session.user.name?.split(" ")[0] ?? "there";
  const initials = player ? `${player.firstName[0] ?? ""}${player.lastName[0] ?? ""}` : (session.user.name ?? "P").slice(0, 1);

  const header = (
    <AppBar dark width="wide">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-lime text-sm font-bold text-lime-ink">{initials.toUpperCase()}</span>
      <div className="min-w-0 flex-1">
        <div className="text-xs opacity-80">{today}</div>
        <div className="truncate font-display text-[22px] font-extrabold">Hi, {firstName}</div>
      </div>
    </AppBar>
  );

  const deniedNotice =
    denied === "admin" ? (
      <Notice tone="warn" icon="lock" className={span}>
        That area is for the league office.
      </Notice>
    ) : notice === "no-team" ? (
      <Notice tone="warn" icon="lock" className={span}>
        Captain tools open once the league office makes you a team captain.
      </Notice>
    ) : null;

  if (!player) {
    return (
      <>
        {header}
        <Screen width="wide">
          {deniedNotice}
          <EmptyState
            icon="user"
            title="No player profile yet"
            action={
              <ButtonLink href="/register/new" variant="accent">
                Register for the season
              </ButtonLink>
            }
          >
            Register for a season to create your player profile and join a team.
          </EmptyState>
        </Screen>
      </>
    );
  }

  const memberships = player.teamMemberships.filter((m) => m.membershipType !== "GAME_PASS");
  const selected = memberships.find((m) => m.id === teamParam) ?? memberships[0];
  const latestRegistration = player.registrations[0];
  const [record, nextMatch] = selected ? await Promise.all([teamRecord(selected.teamId), nextMatchFor(selected.teamId, selected.team.seasonId)]) : [null, null];
  const myAnswer = selected && nextMatch ? await myAvailability(selected.id, nextMatch.id) : null;

  return (
    <>
      {header}
      <Screen width="wide" className="lg:block lg:columns-2 lg:gap-6 lg:[&>*]:mb-5 [&>*]:break-inside-avoid">
        {deniedNotice}

        {latestRegistration ? (
          <Card className={`flex flex-wrap items-center gap-3 !px-3.5 !py-3 ${span}`}>
            <Icon name="clip" className="text-ok" />
            <div className="min-w-[160px] flex-1">
              <b className="text-sm">{latestRegistration.season.name} registration</b>
              <div className="text-xs text-muted">
                {REG_TYPE[latestRegistration.registrationType] ?? "Season"} · {money(latestRegistration.totalAmount)}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <RegistrationBadge status={latestRegistration.status} />
              <PaymentBadge status={latestRegistration.paymentStatus} />
            </div>
          </Card>
        ) : (
          <div className={span}>
            <EmptyState
              icon="clip"
              title="You’re not registered for this season"
              action={
                <ButtonLink href="/register/new" variant="accent" size="sm">
                  Register now
                </ButtonLink>
              }
            >
              Register to get placed on a team.
            </EmptyState>
          </div>
        )}

        <div className={`flex flex-col gap-2.5 ${span}`}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl">My teams</h2>
            <span className="text-sm text-muted">{memberships.length} this season</span>
          </div>
          {memberships.length > 1 ? (
            <Segmented
              label="Switch team"
              active={selected?.id ?? ""}
              items={memberships.map((m) => ({
                key: m.id,
                href: `/portal?team=${m.id}`,
                label: (
                  <>
                    {m.team.name} <span className="text-xs opacity-70">· {m.isCaptain ? "Captain" : "Player"}</span>
                  </>
                ),
              }))}
            />
          ) : null}
        </div>

        {selected ? (
          <Card className="flex flex-col gap-3.5">
            <div className="flex items-center gap-3">
              <Crest team={selected.team} size="lg" />
              <div className="min-w-0 flex-1">
                <h3 className="text-[22px]">{selected.team.name}</h3>
                <div className="text-sm text-muted">
                  {selected.team.division.name} · {selected.team.season.name}
                </div>
              </div>
              <RoleTag role={selected.isCaptain ? "Captain" : "Player"} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge tone="info" dot={false}>
                {selected.id === memberships[0].id ? "Primary team" : "Additional team"}
              </Badge>
              <Badge dot={false}>Season roster</Badge>
              {selected.jerseyNumber != null ? <Badge dot={false}>#{selected.jerseyNumber}</Badge> : null}
              {player.position ? <Badge dot={false}>{player.position}</Badge> : null}
            </div>
            {record ? (
              <div className="grid grid-cols-3 gap-2">
                {[
                  ["Record", `${record.w}-${record.d}-${record.l}`],
                  ["Points", record.points],
                  ["Players", record.players],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-[var(--radius-field)] bg-surface-2 p-2.5">
                    <div className="text-xs text-muted">{k}</div>
                    <b className="font-display text-[22px] font-extrabold">{v}</b>
                  </div>
                ))}
              </div>
            ) : null}
            <AccessPanel
              teamName={selected.team.name}
              isCaptain={selected.isCaptain}
              captainNames={selected.team.roster.map((r) => `${r.player.firstName} ${r.player.lastName}`)}
              requestPending={selected.captainRequest && !selected.isCaptain}
            />
            {selected.isCaptain ? (
              <ButtonLink href={`/captain/${selected.teamId}`} block>
                Open captain tools
                <Icon name="right" className="size-4" />
              </ButtonLink>
            ) : (
              <ButtonLink href={`/portal/team?team=${selected.id}`} variant="ghost" block>
                View team
                <Icon name="right" className="size-4" />
              </ButtonLink>
            )}
          </Card>
        ) : (
          <EmptyState icon="users" title="You’re not on a team yet">
            Once the league office places you on a team, it shows up here.
          </EmptyState>
        )}

        {selected ? (
          nextMatch ? (
            <HeroCard className="flex flex-col gap-3.5">
              <div className="flex items-center justify-between gap-3">
                <span className="eyebrow text-white/75">Next match · Game #{nextMatch.gameNumber}</span>
                <Badge tone="warn">{relativeDay(nextMatch.scheduledAt, now())}</Badge>
              </div>
              <VsRow home={nextMatch.homeTeam} away={nextMatch.awayTeam} onDark />
              <MatchMeta onDark date={nextMatch.date} time={nextMatch.time} field={nextMatch.field} />
              <AvailabilityButtons initial={myAnswer} />
              <ButtonLink href={`/matches/${nextMatch.gameNumber}/print`} size="sm" className="!bg-white !text-[#0F3D2E]">
                <Icon name="print" className="size-4" />
                Print game roster
              </ButtonLink>
            </HeroCard>
          ) : (
            <EmptyState icon="cal" title="No upcoming matches">
              The next {selected.team.name} match shows up here once the schedule is posted.
            </EmptyState>
          )
        ) : null}

        <section className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl">Game passes</h2>
            <ButtonLink href="/register/game-pass" variant="link" size="sm">
              Buy a pass
            </ButtonLink>
          </div>
          {player.gamePasses.length ? (
            <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
              {player.gamePasses.map((gp) => {
                const active = gp.status === "ACTIVE";
                return (
                  <div
                    key={gp.id}
                    className={`flex min-h-[60px] items-center gap-3 border-b border-line px-3.5 py-2.5 last:border-b-0 ${
                      active ? "bg-[linear-gradient(90deg,var(--pass-bg),transparent_70%)] shadow-[inset_3px_0_0_var(--pass)]" : "opacity-65"
                    }`}
                  >
                    <span
                      className={`grid h-9 w-[46px] shrink-0 place-items-center rounded-[9px] border-[1.5px] font-display text-sm font-extrabold ${
                        active ? "border-dashed border-pass text-pass" : "border-line bg-surface-2"
                      }`}
                    >
                      <Icon name="ticket" className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <b className="block text-sm">
                        {gp.match.homeTeam.name} vs {gp.match.awayTeam.name}
                      </b>
                      <span className="text-xs text-muted">
                        Game #{gp.match.gameNumber} · {fmtDay(gp.match.scheduledAt)} · {fmtTime(gp.match.startTime ?? gp.match.scheduledAt)}
                        {gp.match.field ? ` · ${gp.match.field}` : ""}
                      </span>
                    </div>
                    <GamePassStatusBadge status={gp.status} />
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="rounded-[var(--radius-card)] border border-dashed border-line-strong px-4 py-5 text-center text-sm text-muted">No game passes yet.</p>
          )}
          <p className="text-xs text-muted">A pass covers one match. Expired passes stay in your history but not on any roster.</p>
        </section>
      </Screen>
    </>
  );
}
