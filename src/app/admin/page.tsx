import Link from "next/link";
import { PrototypeShell, SectionCard, StatCard, StatusBadge } from "@/components/prototype-shell";
import { matches, players, registrations, teams } from "@/lib/mock-data";

export default function AdminDashboardPage() {
  return (
    <PrototypeShell
      role="admin"
      title="Operations dashboard"
      subtitle="A quick view of what needs attention this week."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pending registrations" value="12" note="4 paid, waiting on review" />
        <StatCard label="Captain requests" value="3" note="2 tied to Spring 2025" />
        <StatCard label="Suspended players" value="2" note="Needs admin follow-up" />
        <StatCard label="Upcoming matches" value="8" note="Across 3 divisions" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="Registration queue"
          action={<Link href="/admin/registrations" className="text-sm font-medium text-sky-700">View all</Link>}
        >
          <div className="space-y-4">
            {registrations.map((registration) => (
              <div key={registration.id} className="flex items-center justify-between rounded-2xl border border-slate-200 p-4">
                <div>
                  <p className="font-medium">{registration.playerName}</p>
                  <p className="text-sm text-slate-500">{registration.teamPreference} · {registration.season}</p>
                </div>
                <StatusBadge label={registration.status} />
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Upcoming matches"
          action={<Link href="/admin/matches" className="text-sm font-medium text-sky-700">Open matches</Link>}
        >
          <div className="space-y-4">
            {matches.map((match) => (
              <div key={match.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium">Game #{match.gameNumber}</p>
                  <StatusBadge label={match.status} />
                </div>
                <p className="mt-2 text-sm text-slate-600">{match.home} vs {match.away}</p>
                <p className="text-sm text-slate-500">{match.startsAt} · {match.field}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <SectionCard title="Players needing attention">
          <div className="space-y-4">
            {players.map((player) => (
              <div key={player.id} className="flex items-center justify-between rounded-2xl border border-slate-200 p-4">
                <div>
                  <p className="font-medium">{player.name}</p>
                  <p className="text-sm text-slate-500">{player.team} · {player.division}</p>
                </div>
                <StatusBadge label={player.status} />
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Team snapshot">
          <div className="space-y-4">
            {teams.map((team) => (
              <div key={team.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{team.name}</p>
                  <p className="text-sm text-slate-500">{team.record}</p>
                </div>
                <p className="mt-2 text-sm text-slate-500">{team.division}</p>
                <p className="mt-1 text-sm text-slate-600">Captains: {team.captains.join(", ")}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </PrototypeShell>
  );
}
