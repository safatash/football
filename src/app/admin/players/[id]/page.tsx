import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, PaymentBadge, RegistrationBadge } from "@/components/ui/badge";
import { Card, CardHeader, EmptyState, KeyValue } from "@/components/ui/card";
import { MATCHES, PLAYERS, division, team } from "@/lib/league-data";
import { ArchivedNotice, Crumbs, isArchived, seasonFrom, withSeason, type SearchParams } from "../../_components/season";
import { PlayerHeader, TeamAccessTable } from "./player-actions";

export const metadata = { title: "Player" };

/** Profile details on file. Only the players below have complete profiles in the league records. */
const PROFILES: Record<string, { born: string; position: string; phone: string; address: string }> = {
  "maya-johnson": { born: "Mar 12, 1994", position: "FWD · #9", phone: "(703) 555-0117", address: "Vienna, VA 22180" },
};

export default async function PlayerDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  const season = seasonFrom(await searchParams);
  const p = PLAYERS.find((x) => x.slug === id);
  if (!p) notFound();
  const profile = PROFILES[p.slug];
  const upcoming = MATCHES.filter((m) => m.status === "Scheduled" && p.teams.some(([t]) => m.home === t || m.away === t));
  const readOnly = isArchived(season);

  return (
    <>
      <PlayerHeader
        name={p.name}
        email={p.email}
        status={p.status}
        note={p.note}
        readOnly={readOnly}
        crumbs={<Crumbs items={[["Players", withSeason("/admin/players", season)], [p.name]]} />}
      />
      <ArchivedNotice season={season} />

      <div className="grid gap-[18px] md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader title="Profile" />
          <KeyValue
            items={[
              ["Born", profile?.born ?? "—"],
              ["Position", profile?.position ?? "—"],
              ["Phone", profile?.phone ?? "—"],
              ["Address", profile?.address ?? "—"],
              ["Player since", p.since],
            ]}
          />
        </Card>
        <Card>
          <CardHeader title="Registration" />
          <KeyValue
            items={[
              ["Season", "Spring 2026"],
              ["Status", <RegistrationBadge key="r" status={p.reg} />],
              ["Payment", <PaymentBadge key="p" status={p.pay} />],
              ["Division", p.div ? division(p.div).name : "—"],
            ]}
          />
          {p.slug === "maya-johnson" ? (
            <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded-[var(--radius-field)] bg-surface-2 p-3.5 text-[13px]">
              Game passes: <b>#207</b> <Badge tone="ok">Active</Badge> · <b>#205</b> <Badge tone="bad">Expired</Badge>
            </div>
          ) : null}
        </Card>
        <Card>
          <CardHeader title="Upcoming matches" />
          {upcoming.length ? (
            <div className="flex flex-col">
              {upcoming.map((m) => (
                <Link key={m.id} href={withSeason(`/admin/matches/${m.id}`, season)} className="flex min-h-11 items-center gap-2.5 rounded-[10px] hover:bg-surface-2">
                  <span className="font-mono text-[13px] text-muted">#{m.id}</span>
                  <span className="flex-1 text-sm">
                    <b>
                      {team(m.home).ab} vs {team(m.away).ab}
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
            readOnly={readOnly}
            teams={p.teams.map(([t, role], i) => ({ id: t, name: team(t).name, division: division(team(t).div).name, membership: i === 0 ? "Primary team" : "Additional team", role }))}
          />
        ) : (
          <EmptyState icon="users" title="No team yet">
            {p.reg === "Game pass only" ? "Game-pass players aren’t on any season roster." : "Assign a team from the registration."}
          </EmptyState>
        )}
        <p className="text-[13px] text-muted">Access is per team. Captain on one team doesn’t give access to another.</p>
      </section>
    </>
  );
}
