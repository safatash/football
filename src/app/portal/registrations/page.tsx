import type { ReactNode } from "react";
import { GamePassStatusBadge, GamePassTag, PaymentBadge, RegistrationBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { AppBar, Screen } from "@/components/shell/layout";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { fmtDay, fmtShort, money } from "../format";

export const metadata = { title: "Registrations" };

const TYPE_LABEL: Record<string, string> = {
  NEW_PLAYER: "Season · New player",
  RETURNING_PLAYER: "Season · Returning player",
  ADDITIONAL_TEAM: "Season · Additional team",
};

type Entry = {
  key: string;
  title: string;
  sub: string;
  amount: string;
  at: Date;
  badges: ReactNode;
};
type Group = { season: string; start: number; entries: Entry[] };

function parseIds(json: string | null): string[] {
  if (!json) return [];
  try {
    const v: unknown = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return json.split(",").map((s) => s.trim()).filter(Boolean);
  }
}

export default async function PlayerRegistrationsPage() {
  const session = await requireUser("/portal/registrations");
  const playerId = session.user.playerId;

  const [registrations, passes] = playerId
    ? await Promise.all([
        prisma.registration.findMany({ where: { playerId }, include: { season: true }, orderBy: { submittedAt: "desc" } }),
        prisma.gamePass
          .findMany({
            where: { playerId },
            include: { payment: true, match: { include: { season: true, homeTeam: true, awayTeam: true } } },
            orderBy: { createdAt: "desc" },
          })
          .catch(() => []),
      ])
    : [[], []];

  // Resolve selected team ids → "Division · Team" titles.
  const teamIds = [...new Set(registrations.flatMap((r) => parseIds(r.selectedTeams)))];
  const teams = teamIds.length
    ? await prisma.team.findMany({ where: { id: { in: teamIds } }, include: { division: true } }).catch(() => [])
    : [];
  const teamLabel = new Map(teams.map((t) => [t.id, `${t.division.name} · ${t.name}`]));

  const groups = new Map<string, Group>();
  const groupFor = (name: string, start: Date) => {
    let g = groups.get(name);
    if (!g) groups.set(name, (g = { season: name, start: start.getTime(), entries: [] }));
    return g;
  };

  for (const r of registrations) {
    const names = parseIds(r.selectedTeams)
      .map((id) => teamLabel.get(id))
      .filter(Boolean);
    groupFor(r.season.name, r.season.startDate).entries.push({
      key: r.id,
      title: names.length ? names.join(", ") : `${r.season.name} season`,
      sub: `${TYPE_LABEL[r.registrationType] ?? "Season"} · ${fmtShort(r.submittedAt)}`,
      amount: money(r.totalAmount),
      at: r.submittedAt,
      badges: (
        <>
          <RegistrationBadge status={r.status} />
          <PaymentBadge status={r.paymentStatus} />
        </>
      ),
    });
  }
  for (const p of passes) {
    const m = p.match;
    groupFor(m.season.name, m.season.startDate).entries.push({
      key: p.id,
      title: `Game pass · ${m.homeTeam.name} vs ${m.awayTeam.name}`,
      sub: `${fmtDay(m.scheduledAt)}${m.field ? ` · ${m.field}` : ""} · Bought ${fmtShort(p.createdAt)}`,
      amount: money(p.payment.amount),
      at: p.createdAt,
      badges: (
        <>
          <GamePassStatusBadge status={p.status} />
          <PaymentBadge status={p.payment.status} />
          <GamePassTag>This match only</GamePassTag>
        </>
      ),
    });
  }
  const ordered = [...groups.values()].sort((a, b) => b.start - a.start);
  ordered.forEach((g) => g.entries.sort((a, b) => b.at.getTime() - a.at.getTime()));

  return (
    <>
      <AppBar title="Registrations" width="wide" />
      <Screen width="wide" className="lg:block lg:columns-2 lg:gap-6 lg:[&>*]:mb-5 [&>*]:break-inside-avoid">
        <div className="flex flex-col gap-1 lg:[column-span:all]">
          <h1 className="text-[34px]">Registrations</h1>
          <p className="text-muted">Every season, team and game pass on your account.</p>
        </div>

        {ordered.length === 0 ? (
          <div className="lg:[column-span:all]">
            <EmptyState
              icon="clip"
              title="No registrations yet"
              action={
                <ButtonLink href="/register/new" variant="accent" size="sm">
                  Register for the season
                </ButtonLink>
              }
            >
              Season registrations and game passes you buy show up here.
            </EmptyState>
          </div>
        ) : (
          ordered.map((g) => (
            <section key={g.season} className="flex flex-col gap-2">
              <span className="eyebrow">{g.season}</span>
              <ul className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
                {g.entries.map((e) => (
                  <li key={e.key} className="flex flex-col gap-2 border-b border-line px-3.5 py-3 last:border-b-0">
                    <div className="flex items-start justify-between gap-3">
                      <b className="text-sm">{e.title}</b>
                      <span className="text-sm font-bold">{e.amount}</span>
                    </div>
                    <div className="text-xs text-muted">{e.sub}</div>
                    <div className="flex flex-wrap gap-1.5">{e.badges}</div>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </Screen>
    </>
  );
}
