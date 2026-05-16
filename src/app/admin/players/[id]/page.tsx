import { PrototypeShell, SectionCard, StatCard, StatusBadge } from "@/components/prototype-shell";
import { captainRoster, matches, players } from "@/lib/mock-data";

export default async function PlayerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const player = players.find((item) => item.id === id) ?? players[0];
  const relatedMatches = matches.filter((match) => match.home === player.team || match.away === player.team);

  return (
    <PrototypeShell
      role="admin"
      title={player.name}
      subtitle="Player detail view for profile, registration state, and active team context."
    >
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Current team" value={player.team} note={player.division} />
        <StatCard label="Position" value={player.position} note="Primary role" />
        <StatCard label="Registration" value={player.registration} note="Spring 2025 status" />
        <StatCard label="Player status" value={player.status} note="Eligibility / admin state" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
        <SectionCard title="Profile summary">
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 p-4">
              <span>Email</span>
              <span className="font-medium">{player.email}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 p-4">
              <span>Phone</span>
              <span className="font-medium">{player.phone}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 p-4">
              <span>Status</span>
              <StatusBadge label={player.status} />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Team access">
          <div className="space-y-3 text-sm">
            {player.teams.map((teamName, index) => (
              <div key={teamName} className="flex items-center justify-between rounded-2xl border border-slate-200 p-4">
                <div>
                  <p className="font-medium">{teamName}</p>
                  <p className="text-slate-500">{index === 0 ? "Primary team" : "Additional team"}</p>
                </div>
                <StatusBadge label={player.role === "captain" && index === 0 ? "Captain Access" : "Player Access"} />
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="mt-6">
        <SectionCard title="Upcoming team matches">
          <div className="space-y-4">
            {relatedMatches.map((match) => (
              <div key={match.id} className="rounded-2xl border border-slate-200 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-medium">Game #{match.gameNumber}</p>
                  <StatusBadge label={match.status} />
                </div>
                <p className="mt-2">{match.home} vs {match.away}</p>
                <p className="text-slate-500">{match.startsAt} · {match.field}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </PrototypeShell>
  );
}
