import type { ReactNode } from "react";
import { GamePassStatusBadge, GamePassTag, PaymentBadge, RegistrationBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { AppBar, Screen } from "@/components/shell/layout";
import { db } from "@/lib/db";
import { now } from "@/lib/clock";
import { passStatus } from "@/lib/game-pass";
import { requireUser } from "@/lib/session";
import { fmtDay, fmtShort, money } from "@/lib/format";

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
        db.registration.findMany({
          where: { playerId },
          include: { season: true, division: true, preferredTeam: true, backupTeam: true },
          orderBy: { submittedAt: "desc" },
        }),
        db.gamePass
          .findMany({
            where: { playerId },
            include: { payment: true, match: { include: { season: true, homeTeam: true, awayTeam: true } } },
            orderBy: { createdAt: "desc" },
          })
          .catch(() => []),
      ])
    : [[], []];

  // Older registrations stored selected teams as ids or names; resolve both to "Division · Team".
  const refs = [...new Set(registrations.flatMap((r) => parseIds(r.selectedTeams)))];
  const teams = refs.length
    ? await db.team
        .findMany({ where: { OR: [{ id: { in: refs } }, { name: { in: refs } }] }, include: { division: true } })
        .catch(() => [])
    : [];
  const teamLabel = (ref: string, seasonId: string) => {
    const t = teams.find((x) => x.id === ref) ?? teams.find((x) => x.name === ref && x.seasonId === seasonId);
    return t ? `${t.division.name} · ${t.name}` : undefined;
  };

  const groups = new Map<string, Group>();
  const groupFor = (name: string, start: Date) => {
    let g = groups.get(name);
    if (!g) groups.set(name, (g = { season: name, start: start.getTime(), entries: [] }));
    return g;
  };

  for (const r of registrations) {
    const picked = [r.preferredTeam, r.backupTeam].filter((t) => t !== null);
    const names = picked.length
      ? picked.map((t) => `${r.division?.name ?? ""}${r.division ? " · " : ""}${t.name}`)
      : r.division
        ? [r.division.name]
        : parseIds(r.selectedTeams)
            .map((ref) => teamLabel(ref, r.seasonId))
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
      title: `Game pass · Game #${m.gameNumber} · ${m.homeTeam.name} vs ${m.awayTeam.name}`,
      sub: `${fmtDay(m.scheduledAt)}${m.field ? ` · ${m.field}` : ""} · Bought ${fmtShort(p.createdAt)}`,
      amount: money(p.payment.amount),
      at: p.createdAt,
      badges: (
        <>
          <GamePassStatusBadge status={passStatus(p, now())} />
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
