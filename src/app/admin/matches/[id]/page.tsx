import { PrototypeShell, SectionCard, StatCard, StatusBadge } from "@/components/prototype-shell";
import { captainRoster, matches } from "@/lib/mock-data";

export default async function MatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const match = matches.find((item) => item.id === id) ?? matches[0];

  return (
    <PrototypeShell
      role="admin"
      title={`Game #${match.gameNumber}`}
      subtitle="Match detail view for scheduling, officials, rosters, and report state."
    >
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Division" value={match.division} note="League grouping" />
        <StatCard label="Fixture" value={`${match.home} vs ${match.away}`} note="Current pairing" />
        <StatCard label="Field" value={match.field} note="Assigned venue" />
        <StatCard label="Score" value={match.score} note={match.status} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard title="Match summary">
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 p-4">
              <span>Date and time</span>
              <span className="font-medium">{match.startsAt}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 p-4">
              <span>Status</span>
              <StatusBadge label={match.status} />
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-slate-500">Officials</p>
              <p className="mt-2 font-medium">{match.officials.join(", ")}</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Roster snapshot">
          <div className="space-y-3">
            {captainRoster.slice(0, 4).map((player) => (
              <div key={player.id} className="flex items-center justify-between rounded-2xl border border-slate-200 p-4 text-sm">
                <span className="font-medium">{player.name}</span>
                <StatusBadge label={player.status} />
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </PrototypeShell>
  );
}
