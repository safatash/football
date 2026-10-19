import Link from "next/link";
import type { ReactNode } from "react";
import prisma from "@/lib/prisma";
import { Avatar, Crest, PageHeading } from "@/components/league";
import { Badge, MatchStatusBadge, PlayerStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader, StatCard } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { BodyCell, BodyRow, DataTable, HeadCell, RowLink, TableBody, TableHead, TableWrap } from "@/components/ui/table";
import { now } from "@/lib/clock";
import { fmtDay, fmtShort } from "@/lib/format";
import { isUpcoming, listMatches, nextMatchDay, reportOverdue } from "@/lib/queries/matches";
import { listPlacements } from "@/lib/queries/placements";
import { suspendedPlayers } from "@/lib/queries/players";
import { listRegistrations, openCaptainRequests, openRegistrationStats } from "@/lib/queries/registrations";
import { standingsByDivision } from "@/lib/queries/standings";
import { rosterWarning } from "@/lib/division-rules";
import { listTeams } from "@/lib/queries/teams";
import { ArchivedNotice, seasonFrom, withSeason, type SearchParams } from "./_components/season";
import { RegistrationTable } from "./_components/registration-table";

export const metadata = { title: "Operations" };

const WEEK_MS = 7 * 864e5;
const ROSTER_STATUS = { DRAFT: "Draft", FINALIZED: "Finalized" } as const;

export default async function OperationsPage({ searchParams }: { searchParams: SearchParams }) {
  const season = await seasonFrom(await searchParams);
  const s = (href: string) => withSeason(href, season);
  const at = now();

  const [stats, queue, captainReqs, suspended, matches, placements, teams] = await Promise.all([
    openRegistrationStats(season.id),
    listRegistrations(season.id, { openOnly: true, take: 5 }),
    openCaptainRequests(season.id),
    suspendedPlayers(season.id),
    listMatches(season.id),
    listPlacements(season, ["NEW"]),
    listTeams(season.id),
  ]);
  const pendingCount = stats.count;
  const oldest = stats.oldest;

  const scheduled = matches.filter((m) => isUpcoming(m, at));
  const sundayDay = nextMatchDay(matches, at);
  const sunday = sundayDay.matches;
  const sundayLabel = sunday[0] ? fmtShort(sunday[0].scheduledAt) : "";
  const homeRosters = sunday.length
    ? await prisma.matchRoster.findMany({
        where: { OR: sunday.map((m) => ({ matchId: m.id, teamId: m.homeTeam.id })) },
        select: { matchId: true, status: true },
      })
    : [];
  const homeRoster = new Map(homeRosters.map((r) => [r.matchId, ROSTER_STATUS[r.status]]));

  const captainsOf = new Map(teams.map((t) => [t.id, t.captains]));
  const overdue = matches.filter((m) => m.status !== "CANCELLED" && (m.reportStatus === "OVERDUE" || reportOverdue(m.scheduledAt, m.reportStatus, at)));
  const toConfirm = matches.filter((m) => m.reportStatus === "SUBMITTED");
  const noRefs = scheduled.filter((m) => m.refsAssigned === 0);
  const attention = suspended.length + overdue.length + toConfirm.length + noRefs.length + captainReqs.length;

  // Division leaders: the top team in every division that has a confirmed result
  const leaders = (await standingsByDivision(season.id)).filter((x) => x.completed && x.rows.length).map((x) => ({ row: x.rows[0], division: x.division }));
  const rosterOf = new Map(teams.map((t) => [t.id, t.rosterSize]));

  const totalWeeks = Math.max(1, Math.ceil((season.endDate.getTime() - season.startDate.getTime()) / WEEK_MS));
  const week = Math.floor((at.getTime() - season.startDate.getTime()) / WEEK_MS) + 1;
  const sub = !season.archived && week >= 1 && week <= totalWeeks ? `${fmtDay(at)} · ${season.name}, week ${week} of ${totalWeeks}` : `${fmtDay(at)} · ${season.name}`;

  return (
    <>
      <PageHeading
        title="Operations"
        sub={sub}
        actions={
          <>
            <ButtonLink href={s("/admin/matches")} variant="ghost" size="sm">
              <Icon name="cal" className="size-4" />
              Schedule
            </ButtonLink>
            <ButtonLink href={s("/admin/registrations?filter=review")} variant="primary" size="sm">
              Review queue
            </ButtonLink>
          </>
        }
      />
      <ArchivedNotice season={season} />

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatCard label="Pending registrations" value={pendingCount} note={pendingCount && oldest ? `Oldest from ${oldest}` : "All caught up"} href={s("/admin/registrations?filter=review")} />
        <StatCard
          label="Captain requests"
          value={captainReqs.length}
          tone="pass"
          note={[...new Set(captainReqs.map((r) => r.team.name))].join(", ")}
          href={s("/admin/registrations?filter=captain")}
        />
        <StatCard label="Suspended players" value={suspended.length} tone="bad" note={suspended.map((p) => p.name).join(", ")} href={s("/admin/players?status=suspended")} />
        <StatCard label="Upcoming matches" value={scheduled.length} note={`${sunday.length} this Sunday`} href={s("/admin/matches")} />
      </div>

      <div className="grid gap-[18px] lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <section className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[26px]">Registration queue</h2>
              <Link href={s("/admin/registrations")} className="text-[13.5px] font-bold text-pitch-2 underline underline-offset-4">
                See all {stats.total}
              </Link>
            </div>
            <RegistrationTable rows={queue} showAmount={false} hrefFor={(id) => s(`/admin/registrations/${id}`)} />
          </section>

          <section className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[26px]">This Sunday</h2>
              <span className="text-[13px] text-muted">{sundayLabel}</span>
            </div>
            <TableWrap>
              <DataTable>
                <TableHead>
                  <tr>
                    <HeadCell>Game</HeadCell>
                    <HeadCell>Match</HeadCell>
                    <HeadCell>Kickoff</HeadCell>
                    <HeadCell>Field</HeadCell>
                    <HeadCell>Officials</HeadCell>
                    <HeadCell>Home roster</HeadCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {sunday.map((m) => {
                    const refs = m.refsAssigned;
                    return (
                      <BodyRow key={m.id}>
                        <BodyCell className="font-mono">
                          <RowLink href={s(`/admin/matches/${m.gameNumber}`)}>#{m.gameNumber}</RowLink>
                        </BodyCell>
                        <BodyCell className="min-w-[200px]">
                          <b>{m.homeTeam.name}</b> <span className="text-muted">vs</span> <b>{m.awayTeam.name}</b>
                        </BodyCell>
                        <BodyCell className="whitespace-nowrap">{m.time}</BodyCell>
                        <BodyCell className="whitespace-nowrap">{m.field}</BodyCell>
                        <BodyCell>
                          <Badge tone={refs === 3 ? "ok" : "warn"}>{refs} of 3</Badge>
                        </BodyCell>
                        <BodyCell>
                          <MatchStatusBadge status={homeRoster.get(m.id) ?? "Not started"} />
                        </BodyCell>
                      </BodyRow>
                    );
                  })}
                </TableBody>
              </DataTable>
            </TableWrap>
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-[18px]">
          <Card>
            <CardHeader
              title="Needs attention"
              action={
                <Badge tone="bad" dot={false}>
                  {attention}
                </Badge>
              }
            />
            <div className="flex flex-col gap-1">
              {suspended.map((p) => (
                <AttentionRow
                  key={p.id}
                  href={s(`/admin/players/${p.id}`)}
                  icon={<Avatar name={p.name} />}
                  title={p.name}
                  badge={<PlayerStatusBadge status={p.status} />}
                  sub={p.note}
                />
              ))}
              {overdue.map((m) => {
                const caps = [...(captainsOf.get(m.homeTeam.id) ?? []), ...(captainsOf.get(m.awayTeam.id) ?? [])];
                return (
                  <AttentionRow
                    key={m.id}
                    href={s(`/admin/matches/${m.gameNumber}`)}
                    icon={<IconTile name="clip" />}
                    title={`Game #${m.gameNumber} report overdue`}
                    badge={<Badge tone="bad">Overdue</Badge>}
                    sub={`${m.homeTeam.name} vs ${m.awayTeam.name}${caps.length ? ` · ${caps.join(", ")}` : ""}`}
                  />
                );
              })}
              {toConfirm.map((m) => (
                <AttentionRow
                  key={m.id}
                  href={s(`/admin/matches/${m.gameNumber}`)}
                  icon={<IconTile name="clip" />}
                  title={`Game #${m.gameNumber} report to confirm`}
                  badge={<MatchStatusBadge status="SUBMITTED" />}
                  sub={`${m.homeTeam.name} vs ${m.awayTeam.name}${m.score ? ` · ${m.score[0]}–${m.score[1]}` : ""}`}
                />
              ))}
              {noRefs.map((m) => (
                <AttentionRow
                  key={m.id}
                  href={s(`/admin/matches/${m.gameNumber}`)}
                  icon={<IconTile name="whistle" />}
                  title={`Game #${m.gameNumber} has no referee`}
                  badge={<Badge tone="warn">{fmtShort(m.scheduledAt)}</Badge>}
                  sub={`${m.homeTeam.name} vs ${m.awayTeam.name}`}
                />
              ))}
              {captainReqs.map((r) => (
                <AttentionRow
                  key={r.id}
                  href={s(r.registrationId ? `/admin/registrations/${r.registrationId}` : `/admin/players/${r.player.id}`)}
                  icon={<Avatar name={r.name} />}
                  title={r.name}
                  badge={<Badge tone="pass">Captain request</Badge>}
                  sub={r.team.name}
                />
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Placement queue"
              action={
                <Link href={s("/admin/placements")} className="text-[13.5px] font-bold text-pitch-2 underline underline-offset-4">
                  Open
                </Link>
              }
            />
            <div className="flex flex-col">
              {placements.map((p) => (
                <Link key={p.id} href={s(`/admin/placements/${p.id}`)} className="flex min-h-12 items-center gap-2.5 rounded-[10px] py-1.5 hover:bg-surface-2">
                  <Avatar name={p.name} />
                  <div className="min-w-0 flex-1">
                    <b className="text-sm">{p.name}</b>
                    <div className="truncate text-xs text-muted">
                      {p.division?.name ?? "—"} · {p.level} · {p.pos}
                    </div>
                  </div>
                  <Icon name="right" className="size-4 text-faint" />
                </Link>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Division leaders"
              action={
                <Link href={s("/admin/standings")} className="text-[13.5px] font-bold text-pitch-2 underline underline-offset-4">
                  All standings
                </Link>
              }
            />
            {leaders.length ? (
              <DataTable className="text-[13.5px]">
                <TableHead>
                  <tr>
                    <HeadCell>Team</HeadCell>
                    <HeadCell align="right">Roster</HeadCell>
                    <HeadCell align="right">Pts</HeadCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {leaders.map(({ row, division }) => {
                    const t = row.team;
                    const size = rosterOf.get(t.id) ?? 0;
                    const warn = rosterWarning(size, division);
                    return (
                      <BodyRow key={t.id}>
                        <BodyCell className="px-2">
                          <span className="flex items-center gap-2">
                            <Crest team={t} />
                            <span className="min-w-0">
                              <RowLink href={s(`/admin/teams/${t.code ?? t.id}`)}>{t.name}</RowLink>
                              <div className="text-xs text-muted">{division.name}</div>
                            </span>
                          </span>
                        </BodyCell>
                        <BodyCell align="right" className="px-2 whitespace-nowrap">
                          {size}
                          {warn ? (
                            <Badge tone="warn" dot={false} className="ml-1.5">
                              <span title={warn}>{size < (division.rosterMin ?? 0) ? "Low" : "High"}</span>
                            </Badge>
                          ) : null}
                        </BodyCell>
                        <BodyCell align="right" className="px-2">
                          <b>{row.pts}</b>
                        </BodyCell>
                      </BodyRow>
                    );
                  })}
                </TableBody>
              </DataTable>
            ) : (
              <p className="text-[13.5px] text-muted">No confirmed results yet. Leaders appear after the first match report is confirmed.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function IconTile({ name }: { name: "clip" | "whistle" }) {
  return (
    <span className="grid size-[34px] shrink-0 place-items-center rounded-full bg-surface-3">
      <Icon name={name} className="size-[18px]" />
    </span>
  );
}

function AttentionRow({ href, icon, title, badge, sub }: { href: string; icon: ReactNode; title: string; badge: ReactNode; sub?: string }) {
  return (
    <Link href={href} className="flex min-h-12 items-start gap-2.5 rounded-[10px] py-1.5 hover:bg-surface-2">
      {icon}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <b className="text-sm">{title}</b>
          {badge}
        </div>
        {sub ? <div className="text-xs text-muted">{sub}</div> : null}
      </div>
    </Link>
  );
}
