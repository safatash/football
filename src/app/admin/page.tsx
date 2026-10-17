import Link from "next/link";
import type { ReactNode } from "react";
import prisma from "@/lib/prisma";
import { Avatar, Crest, PageHeading } from "@/components/league";
import { Badge, MatchStatusBadge, PlayerStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader, StatCard } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { BodyCell, BodyRow, DataTable, HeadCell, RowLink, TableBody, TableHead, TableWrap } from "@/components/ui/table";
import {
  ACTIVE_SEASON,
  MATCHES,
  PLACEMENTS,
  PLAYERS,
  REGISTRATIONS,
  TEAMS,
  TODAY_LABEL,
  division,
  points,
  refsAssigned,
  team,
} from "@/lib/league-data";
import { ArchivedNotice, seasonFrom, withSeason, type SearchParams } from "./_components/season";
import { loadDbRegistrations, samplePending, shortDate, type RegListRow } from "./_components/registration-data";
import { RegistrationTable } from "./_components/registration-table";

export const metadata = { title: "Operations" };

const HOME_ROSTER: Record<number, string> = { 204: "Draft", 206: "Finalized" };

export default async function OperationsPage({ searchParams }: { searchParams: SearchParams }) {
  const season = seasonFrom(await searchParams);
  const s = (href: string) => withSeason(href, season);

  const pendingSample = samplePending();
  let pendingCount = pendingSample.length;
  let oldest = "May 9";
  let queue: RegListRow[] = [];
  try {
    pendingCount = await prisma.registration.count({ where: { status: "PENDING" } });
    const first = await prisma.registration.findFirst({ where: { status: "PENDING" }, orderBy: { submittedAt: "asc" }, select: { submittedAt: true } });
    oldest = first ? shortDate(first.submittedAt) : "";
    queue = pendingCount ? await loadDbRegistrations({ pendingOnly: true, take: 5 }) : [];
  } catch {
    pendingCount = pendingSample.length;
    oldest = "May 9";
  }
  const usingSample = queue.length === 0;
  if (usingSample) queue = pendingSample.slice(0, 5);

  const captainReqs = REGISTRATIONS.filter((r) => r.captainRequest && (r.reg === "Submitted" || r.reg === "Pending Review"));
  const suspended = PLAYERS.filter((p) => p.status === "Suspended");
  const scheduled = MATCHES.filter((m) => m.status === "Scheduled");
  const sunday = scheduled.filter((m) => m.date === "Sun, May 17");
  const overdue = MATCHES.filter((m) => m.report === "Overdue");
  const noRefs = scheduled.filter((m) => refsAssigned(m) === 0);
  const attention = suspended.length + overdue.length + noRefs.length;

  return (
    <>
      <PageHeading
        title="Operations"
        sub={`${TODAY_LABEL} · ${ACTIVE_SEASON}, week 8 of 14`}
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
          note={[...new Set(captainReqs.map((r) => r.pref))].join(", ")}
          href={s("/admin/registrations?filter=captain")}
        />
        <StatCard label="Suspended players" value={suspended.length} tone="bad" note="1 red card · 1 payment" href={s("/admin/players?status=suspended")} />
        <StatCard label="Upcoming matches" value={scheduled.length} note={`${sunday.length} this Sunday`} href={s("/admin/matches")} />
      </div>

      <div className="grid gap-[18px] lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <section className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[26px]">Registration queue</h2>
              <Link href={s("/admin/registrations")} className="text-[13.5px] font-bold text-pitch-2 underline underline-offset-4">
                See all{usingSample ? ` ${REGISTRATIONS.length}` : ""}
              </Link>
            </div>
            <RegistrationTable rows={queue} showAmount={false} hrefFor={(id) => s(`/admin/registrations/${id}`)} />
          </section>

          <section className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[26px]">This Sunday</h2>
              <span className="text-[13px] text-muted">May 17</span>
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
                    const refs = refsAssigned(m);
                    return (
                      <BodyRow key={m.id}>
                        <BodyCell className="font-mono">
                          <RowLink href={s(`/admin/matches/${m.id}`)}>#{m.id}</RowLink>
                        </BodyCell>
                        <BodyCell className="min-w-[200px]">
                          <b>{team(m.home).name}</b> <span className="text-muted">vs</span> <b>{team(m.away).name}</b>
                        </BodyCell>
                        <BodyCell className="whitespace-nowrap">{m.time}</BodyCell>
                        <BodyCell className="whitespace-nowrap">{m.field}</BodyCell>
                        <BodyCell>
                          <Badge tone={refs === 3 ? "ok" : "warn"}>{refs} of 3</Badge>
                        </BodyCell>
                        <BodyCell>
                          <MatchStatusBadge status={HOME_ROSTER[m.id] ?? "Not started"} />
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
                  key={p.slug}
                  href={s(`/admin/players/${p.slug}`)}
                  icon={<Avatar name={p.name} />}
                  title={p.name}
                  badge={<PlayerStatusBadge status={p.status} />}
                  sub={p.note}
                />
              ))}
              {overdue.map((m) => (
                <AttentionRow
                  key={m.id}
                  href={s(`/admin/matches/${m.id}`)}
                  icon={<IconTile name="clip" />}
                  title={`Game #${m.id} report overdue`}
                  badge={<Badge tone="bad">Overdue</Badge>}
                  sub={`${team(m.home).name} vs ${team(m.away).name} · ${team(m.home).caps[0]}`}
                />
              ))}
              {noRefs.map((m) => (
                <AttentionRow
                  key={m.id}
                  href={s(`/admin/matches/${m.id}`)}
                  icon={<IconTile name="whistle" />}
                  title={`Game #${m.id} has no referee`}
                  badge={<Badge tone="warn">{m.date.replace("Sun, ", "")}</Badge>}
                  sub={`${team(m.home).name} vs ${team(m.away).name}`}
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
              {PLACEMENTS.filter((p) => p.state === "New").map((p) => (
                <Link key={p.id} href={s(`/admin/placements/${p.id}`)} className="flex min-h-12 items-center gap-2.5 rounded-[10px] py-1.5 hover:bg-surface-2">
                  <Avatar name={p.name} />
                  <div className="min-w-0 flex-1">
                    <b className="text-sm">{p.name}</b>
                    <div className="truncate text-xs text-muted">
                      {division(p.div).name} · {p.level} · {p.pos}
                    </div>
                  </div>
                  <Icon name="right" className="size-4 text-faint" />
                </Link>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Team snapshot"
              action={
                <Link href={s("/admin/teams")} className="text-[13.5px] font-bold text-pitch-2 underline underline-offset-4">
                  All teams
                </Link>
              }
            />
            <DataTable className="text-[13.5px]">
              <TableHead>
                <tr>
                  <HeadCell>Team</HeadCell>
                  <HeadCell align="right">Roster</HeadCell>
                  <HeadCell align="right">Pts</HeadCell>
                </tr>
              </TableHead>
              <TableBody>
                {TEAMS.slice(0, 6).map((t) => (
                  <BodyRow key={t.id}>
                    <BodyCell className="px-2">
                      <span className="flex items-center gap-2">
                        <Crest teamId={t.id} />
                        <span className="min-w-0">
                          <RowLink href={s(`/admin/teams/${t.id}`)}>{t.name}</RowLink>
                          <div className="text-xs text-muted">{division(t.div).name}</div>
                        </span>
                      </span>
                    </BodyCell>
                    <BodyCell align="right" className="px-2 whitespace-nowrap">
                      {t.size}
                      {t.size < 16 ? (
                        <Badge tone="warn" dot={false} className="ml-1.5">
                          Low
                        </Badge>
                      ) : null}
                    </BodyCell>
                    <BodyCell align="right" className="px-2">
                      <b>{points(t)}</b>
                    </BodyCell>
                  </BodyRow>
                ))}
              </TableBody>
            </DataTable>
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
