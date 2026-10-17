import Link from "next/link";
import { Fragment } from "react";
import { notFound } from "next/navigation";
import { Badge, PaymentBadge, RegistrationBadge } from "@/components/ui/badge";
import { Card, CardHeader, EmptyState, KeyValue } from "@/components/ui/card";
import { isUpcoming, listMatches } from "@/lib/queries/matches";
import { getPlayer } from "@/lib/queries/players";
import { ArchivedNotice, Crumbs, seasonFrom, withSeason, type SearchParams } from "../../_components/season";
import prisma from "@/lib/prisma";
import { now } from "@/lib/clock";
import { dayKey, fmtShort } from "@/lib/format";
import { isAdminEmail } from "@/lib/admin";
import { listTeams } from "@/lib/queries/teams";
import { getSession } from "@/lib/session";
import { AddToTeam, CaptainRequests, LeagueOfficeAccess, PlayerHeader, TeamAccessTable } from "./player-actions";

export const metadata = { title: "Player" };

export default async function PlayerDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  const season = await seasonFrom(await searchParams);
  const p = await getPlayer(id, season.id);
  if (!p) notFound();
  const teamIds = new Set(p.teams.map((t) => t.id));
  const upcoming = p.teams.length
    ? (await listMatches(season.id)).filter((m) => isUpcoming(m) && (teamIds.has(m.homeTeam.id) || teamIds.has(m.awayTeam.id)))
    : [];
  const readOnly = season.archived;
  const [seasonTeams, session] = await Promise.all([listTeams(season.id), getSession()]);
  const onTeam = new Set(p.teams.map((t) => t.id));
  const addable = seasonTeams.filter((t) => !onTeam.has(t.id)).map((t) => ({ id: t.id, name: t.name, division: t.division.name }));
  const requests = await prisma.captainRequest.findMany({
    where: { playerId: p.id, status: "PENDING", team: { seasonId: season.id } },
    select: { id: true, note: true, createdAt: true, team: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
  // Two weeks from today, as the default "eligible again" date
  const defaultUntil = dayKey(new Date(now().getTime() + 14 * 864e5));

  return (
    <>
      <PlayerHeader
        playerId={p.id}
        defaultUntil={defaultUntil}
        name={p.name}
        email={p.email}
        status={p.status}
        note={p.note}
        readOnly={readOnly}
        crumbs={<Crumbs items={[["Players", withSeason("/admin/players", season)], [p.name]]} />}
      />
      <ArchivedNotice season={season} />
      {requests.length ? (
        <CaptainRequests readOnly={readOnly} requests={requests.map((r) => ({ id: r.id, teamName: r.team.name, note: r.note, requested: fmtShort(r.createdAt) }))} />
      ) : null}

      <div className="grid gap-[18px] md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader title="Profile" />
          <KeyValue
            items={[
              ["Born", p.born],
              ["Position", p.position],
              ["Phone", p.phone],
              ["Address", p.address],
              ["Player since", p.since],
            ]}
          />
        </Card>
        <Card>
          <CardHeader title="Registration" />
          <KeyValue
            items={[
              ["Season", season.name],
              ["Status", <RegistrationBadge key="r" status={p.reg} />],
              ["Payment", <PaymentBadge key="p" status={p.pay} />],
              ["Division", p.division?.name ?? "—"],
            ]}
          />
          {p.passes.length ? (
            <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded-[var(--radius-field)] bg-surface-2 p-3.5 text-[13px]">
              Game passes:{" "}
              {p.passes.map((g, i) => (
                <Fragment key={g.id}>
                  {i > 0 ? " · " : null}
                  <b>#{g.gameNumber}</b> {g.active ? <Badge tone="ok">Active</Badge> : <Badge tone="bad">Expired</Badge>}
                </Fragment>
              ))}
            </div>
          ) : null}
        </Card>
        <Card>
          <CardHeader title="Upcoming matches" />
          {upcoming.length ? (
            <div className="flex flex-col">
              {upcoming.map((m) => (
                <Link key={m.id} href={withSeason(`/admin/matches/${m.gameNumber}`, season)} className="flex min-h-11 items-center gap-2.5 rounded-[10px] hover:bg-surface-2">
                  <span className="font-mono text-[13px] text-muted">#{m.gameNumber}</span>
                  <span className="flex-1 text-sm">
                    <b>
                      {m.homeTeam.shortName ?? m.homeTeam.name} vs {m.awayTeam.shortName ?? m.awayTeam.name}
                    </b>{" "}
                    · {m.date.slice(5)}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState icon="cal" title="No upcoming matches" />
          )}
        </Card>
      </div>

      <section className="flex flex-col gap-2.5">
        <h2 className="text-[26px]">Team access</h2>
        {p.teams.length ? (
          <TeamAccessTable
            playerId={p.id}
            playerName={p.name}
            readOnly={readOnly}
            teams={p.teams.map((t, i) => ({
              id: t.id,
              name: t.name,
              color: t.color,
              shortName: t.shortName,
              division: t.division.name,
              membership: i === 0 ? "Primary team" : "Additional team",
              role: t.role,
            }))}
          />
        ) : (
          <EmptyState icon="users" title="No team yet">
            {p.passGame != null ? "Game-pass players aren’t on any season roster." : "Add them to a team below, or assign one from their registration."}
          </EmptyState>
        )}
        {readOnly ? null : <AddToTeam playerId={p.id} teams={addable} />}
        <p className="text-[13px] text-muted">Access is per team. Captain on one team doesn’t give access to another.</p>
      </section>

      <section className="flex max-w-[640px] flex-col gap-2.5">
        <h2 className="text-[26px]">League office</h2>
        <Card>
          <LeagueOfficeAccess
            email={p.email}
            isAdmin={p.role === "ADMIN" || isAdminEmail(p.email)}
            viaSetting={isAdminEmail(p.email)}
            isSelf={session?.user?.id === p.userId}
          />
        </Card>
      </section>
    </>
  );
}
