import Link from "next/link";
import { notFound } from "next/navigation";
import { Crest, Jersey, MatchMeta, PageHeading, PosTag, VsRow, vsFor } from "@/components/league";
import { MatchStatusBadge, PlayerStatusBadge, RoleTag } from "@/components/ui/badge";
import { EmptyState, StatCard } from "@/components/ui/card";
import { BodyCell, BodyRow, DataTable, HeadCell, RowLink, TableBody, TableHead, TableWrap } from "@/components/ui/table";
import { BLD_ROSTER, FFX_ROSTER, MATCHES, PLAYERS, TEAMS, division, points, type RosterPlayer } from "@/lib/league-data";
import { ArchivedNotice, Crumbs, isArchived, seasonFrom, withSeason, type SearchParams } from "../../_components/season";
import { ToastButton } from "../../_components/toast-button";

export const metadata = { title: "Team" };

const ROSTERS: Record<string, Pick<RosterPlayer, "name" | "jersey" | "pos" | "captain" | "suspended">[]> = { ffx: FFX_ROSTER, bld: BLD_ROSTER };

export default async function TeamDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  const season = seasonFrom(await searchParams);
  const t = TEAMS.find((x) => x.id === id);
  if (!t) notFound();
  const s = (href: string) => withSeason(href, season);
  const roster = ROSTERS[t.id] ?? [];
  const schedule = MATCHES.filter((m) => m.home === t.id || m.away === t.id);
  const gd = t.gf - t.ga;

  return (
    <>
      <div className="flex flex-col gap-2">
        <Crumbs items={[["Teams", s("/admin/teams")], [t.name]]} />
        <PageHeading
          title={
            <span className="flex items-center gap-3.5">
              <Crest teamId={t.id} size="lg" />
              {t.name}
            </span>
          }
          sub={`${division(t.div).name} · ${season} · home field ${t.home}`}
          actions={<ToastButton label="Message captains" icon="mail" message={`Message sent to ${t.caps.join(" & ")}`} disabled={isArchived(season)} />}
        />
      </div>
      <ArchivedNotice season={season} />

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatCard label="Record W-D-L" value={`${t.w}-${t.d}-${t.l}`} note={`${points(t)} points`} />
        <StatCard label="Goals for / against" value={t.gf} suffix={` / ${t.ga}`} note={`GD ${gd > 0 ? "+" : ""}${gd}`} />
        <StatCard label="Roster size" value={t.size} note="Max 22" />
        <StatCard
          label="Captains"
          value={
            <span className="block text-[22px] leading-[1.15]">
              {t.caps.map((c) => (
                <span key={c} className="block">
                  {c}
                </span>
              ))}
            </span>
          }
          note="Approved by the league office"
        />
      </div>

      <div className="grid gap-[18px] lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="flex min-w-0 flex-col gap-2.5">
          <h2 className="text-[26px]">Roster</h2>
          {roster.length ? (
            <TableWrap>
              <DataTable>
                <TableHead>
                  <tr>
                    <HeadCell>#</HeadCell>
                    <HeadCell>Player</HeadCell>
                    <HeadCell>Pos</HeadCell>
                    <HeadCell>Status</HeadCell>
                    <HeadCell>Access</HeadCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {roster.map((p) => {
                    const profile = PLAYERS.find((x) => x.name === p.name);
                    return (
                      <BodyRow key={p.jersey}>
                        <BodyCell>
                          <Jersey n={p.jersey} small />
                        </BodyCell>
                        <BodyCell className="whitespace-nowrap">{profile ? <RowLink href={s(`/admin/players/${profile.slug}`)}>{p.name}</RowLink> : <b>{p.name}</b>}</BodyCell>
                        <BodyCell>
                          <PosTag pos={p.pos} />
                        </BodyCell>
                        <BodyCell>
                          <PlayerStatusBadge status={p.suspended ? "Suspended" : "Active"} />
                        </BodyCell>
                        <BodyCell>
                          <RoleTag role={p.captain ? "Captain" : "Player"} />
                        </BodyCell>
                      </BodyRow>
                    );
                  })}
                </TableBody>
              </DataTable>
            </TableWrap>
          ) : (
            <EmptyState icon="users" title={`${t.size} players on this team`}>
              Open a player from the Players list to see their access.
            </EmptyState>
          )}
        </section>

        <section className="flex min-w-0 flex-col gap-2.5">
          <h2 className="text-[26px]">Schedule</h2>
          {schedule.length ? (
            schedule.map((m) => (
              <Link key={m.id} href={s(`/admin/matches/${m.id}`)} className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 hover:border-line-strong">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[13px] text-muted">#{m.id}</span>
                  <MatchStatusBadge status={m.status} />
                </div>
                <VsRow {...vsFor(m)} score={m.score} />
                <MatchMeta date={m.date} time={m.time} field={m.field} />
              </Link>
            ))
          ) : (
            <EmptyState icon="cal" title="No matches" />
          )}
        </section>
      </div>
    </>
  );
}
