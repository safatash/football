import { PrototypeShell, SectionCard, StatCard, StatusBadge } from "@/components/prototype-shell";
import { Button } from "@/components/ui/button";
import { captainRoster, matchRosterPool, matches } from "@/lib/mock-data";

export default function CaptainDashboardPage() {
  const activeGamePassPlayers = matchRosterPool.filter(
    (player) => player.matchId === "match-1" && player.gamePass && player.passStatus === "Active for match day",
  );

  return (
    <PrototypeShell
      role="captain"
      title="Captain dashboard"
      subtitle="Prepare your roster, lock in the lineup, and submit the match report."
    >
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Next match" value="Sun 9:00 AM" note="Fairfax United vs Alexandria FC" />
        <StatCard label="Available players" value="14" note="2 flagged unavailable" />
        <StatCard label="Lineup status" value="Draft" note="Needs final check before kickoff" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <SectionCard title="Upcoming match">
          <div className="space-y-2 text-sm">
            <p className="font-medium">{matches[0].home} vs {matches[0].away}</p>
            <p className="text-slate-500">{matches[0].startsAt}</p>
            <p className="text-slate-500">{matches[0].field}</p>
            <div className="pt-2">
              <a href="/captain/matches/match-1/roster" className="text-sm font-medium text-sky-700">Open match roster</a>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Roster snapshot">
          <div className="space-y-3">
            {captainRoster.slice(0, 3).map((player) => (
              <div key={player.id} className="flex items-center justify-between rounded-2xl border border-slate-200 p-4 text-sm">
                <span>{player.name}</span>
                <span className="text-slate-500">#{player.jersey} · {player.status}</span>
              </div>
            ))}
            <div className="grid gap-3 pt-2 md:grid-cols-2">
              <Button>Print game roster</Button>
              <a href="/captain/team" className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 transition hover:bg-slate-50">Manage team</a>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <SectionCard title="Captain permissions">
          <div className="space-y-4 text-sm">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-slate-700">
              <p className="font-medium">Captain can</p>
              <ul className="mt-2 space-y-2">
                <li>Manage their own team roster</li>
                <li>Print the game roster from the front end</li>
                <li>Open match roster and adjust match-day availability</li>
                <li>Monitor single-match game-pass participation</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4 text-slate-600">
              These controls should exist only for the captain role, not for normal logged-in players.
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Single-match game pass watch">
          <div className="space-y-4 text-sm">
            {activeGamePassPlayers.length > 0 ? (
              activeGamePassPlayers.map((player) => (
                <div key={player.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-slate-700">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{player.name}</p>
                      <p className="mt-1">{player.rosterScope}</p>
                    </div>
                    <StatusBadge label={player.passStatus} />
                  </div>
                  <p className="mt-3">This player is valid only for this match. Once the game is completed, they should drop off future roster views automatically.</p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-slate-200 p-4 text-slate-600">
                No active game-pass players are attached to this upcoming roster.
              </div>
            )}
          </div>
        </SectionCard>
      </div>
    </PrototypeShell>
  );
}
