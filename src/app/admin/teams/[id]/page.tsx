import Link from "next/link";
import { notFound } from "next/navigation";
import { Crest, Jersey, MatchMeta, PageHeading, PosTag, VsRow } from "@/components/league";
import { MatchStatusBadge, PlayerStatusBadge, RoleTag } from "@/components/ui/badge";
import { EmptyState, StatCard } from "@/components/ui/card";
import { BodyCell, BodyRow, DataTable, HeadCell, RowLink, TableBody, TableHead, TableWrap } from "@/components/ui/table";
import { listMatches } from "@/lib/queries/matches";
import { loadStandings } from "@/lib/queries/standings";
import { getTeam, teamRoster } from "@/lib/queries/teams";
import { ArchivedNotice, Crumbs, seasonFrom, withSeason, type SearchParams } from "../../_components/season";
import { ToastButton } from "../../_components/toast-button";

export const metadata = { title: "Team" };

export default async function TeamDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  const season = await seasonFrom(await searchParams);
  const t = await getTeam(id, season.id);
  if (!t || t.seasonId !== season.id) notFound();
  const s = (href: string) => withSeason(href, season);
  const [roster, schedule, table] = await Promise.all([teamRoster(t.id), listMatches(season.id, { teamId: t.id }), loadStandings(season.id, t.division.id)]);
  const rec = table.find((r) => r.team.id === t.id);
  const [w, d, l, gf, ga, pts] = [rec?.w ?? 0, rec?.d ?? 0, rec?.l ?? 0, rec?.gf ?? 0, rec?.ga ?? 0, rec?.pts ?? 0];
  const gd = gf - ga;
  const caps = roster.filter((p) => p.isCaptain).map((p) => p.name);

  return (
    <>
      <div className="flex flex-col gap-2">
        <Crumbs items={[["Teams", s("/admin/teams")], [t.name]]} />
        <PageHeading
          title={
            <span className="flex items-center gap-3.5">
              <Crest team={t} size="lg" />
              {t.name}
            </span>
          }
          sub={[t.division.name, season.name, t.homeField ? `home field ${t.homeField}` : null].filter(Boolean).join(" · ")}
          actions={<ToastButton label="Message captains" icon="mail" message={`Message sent to ${caps.join(" & ")}`} disabled={season.archived || !caps.length} />}
        />
      </div>
      <ArchivedNotice season={season} />

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatCard label="Record W-D-L" value={`${w}-${d}-${l}`} note={`${pts} points`} />
        <StatCard label="Goals for / against" value={gf} suffix={` / ${ga}`} note={`GD ${gd > 0 ? "+" : ""}${gd}`} />
        <StatCard label="Roster size" value={roster.length} note={`Max ${t.maxPlayers}`} />
        <StatCard
          label="Captains"
          value={
            <span className="block text-[22px] leading-[1.15]">
              {caps.length
                ? caps.map((c) => (
                    <span key={c} className="block">
                      {c}
                    </span>
                  ))
                : "—"}
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
                  {roster.map((p) => (
                    <BodyRow key={p.id}>
                      <BodyCell>
                        <Jersey n={p.jerseyNumber ?? "—"} small />
                      </BodyCell>
                      <BodyCell className="whitespace-nowrap">
                        <RowLink href={s(`/admin/players/${p.player.id}`)}>{p.name}</RowLink>
                      </BodyCell>
                      <BodyCell>{p.player.position ? <PosTag pos={p.player.position} /> : null}</BodyCell>
                      <BodyCell>
                        <PlayerStatusBadge status={p.suspended ? "Suspended" : "Active"} />
                      </BodyCell>
                      <BodyCell>
                        <RoleTag role={p.isCaptain ? "Captain" : "Player"} />
                      </BodyCell>
                    </BodyRow>
                  ))}
                </TableBody>
              </DataTable>
            </TableWrap>
          ) : (
            <EmptyState icon="users" title="No players on this team yet">
              Players appear here once they’re placed on {t.name}.
            </EmptyState>
          )}
        </section>

        <section className="flex min-w-0 flex-col gap-2.5">
          <h2 className="text-[26px]">Schedule</h2>
          {schedule.length ? (
            schedule.map((m) => (
              <Link key={m.id} href={s(`/admin/matches/${m.gameNumber}`)} className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 hover:border-line-strong">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[13px] text-muted">#{m.gameNumber}</span>
                  <MatchStatusBadge status={m.status} />
                </div>
                <VsRow home={m.homeTeam} away={m.awayTeam} score={m.score} />
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
