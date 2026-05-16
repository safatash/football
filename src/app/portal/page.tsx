import { PrototypeShell, SectionCard, StatCard, StatusBadge } from "@/components/prototype-shell";
import { Button } from "@/components/ui/button";
import { matches, players, registrations } from "@/lib/mock-data";

export default function PlayerDashboardPage() {
  const player = players[0];
  const activeGamePass = player.gamePasses.find((pass) => pass.status === "Active for match day");
  const expiredGamePasses = player.gamePasses.filter((pass) => pass.status === "Expired after match");
  const primaryMembership = player.teamMemberships[0];

  return (
    <PrototypeShell
      role="player"
      title="Player dashboard"
      subtitle="Current registration, team placement, and upcoming match context."
    >
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Current registration" value="Pending Review" note="Spring 2025" />
        <StatCard label="Next match" value="Sun 9:00 AM" note="Wakefield Park 3" />
        <StatCard label="Current team" value="Fairfax United" note="Women Premier" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <SectionCard title="Registration status">
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{registrations[0].season}</p>
                <p className="text-sm text-slate-500">Preferred team: {registrations[0].teamPreference}</p>
              </div>
              <StatusBadge label={registrations[0].status} />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Upcoming match">
          <div className="space-y-2 text-sm">
            <p className="font-medium">{matches[0].home} vs {matches[0].away}</p>
            <p className="text-slate-500">{matches[0].startsAt}</p>
            <p className="text-slate-500">{matches[0].field}</p>
          </div>
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard title="My teams">
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
              {player.teamMemberships.map((membership, index) => (
                <div
                  key={membership.id}
                  className={`rounded-t-2xl border px-4 py-2 text-sm font-medium ${
                    index === 0
                      ? "border-slate-300 bg-white text-slate-900"
                      : "border-slate-200 bg-slate-50 text-slate-600"
                  }`}
                >
                  {membership.teamName}
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold">{primaryMembership.teamName}</p>
                  <p className="text-slate-500">Primary team account view</p>
                </div>
                <StatusBadge label={primaryMembership.membershipType} />
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-slate-500">Division</p>
                  <p className="mt-2 font-medium">{primaryMembership.division}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-slate-500">Access level</p>
                  <p className="mt-2 font-medium">{primaryMembership.accessLevel}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-slate-500">Season</p>
                  <p className="mt-2 font-medium">{primaryMembership.season}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-slate-500">Membership type</p>
                  <p className="mt-2 font-medium">{primaryMembership.membershipType}</p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
                <p className="font-medium">This team view</p>
                <p className="mt-2">{primaryMembership.notes}</p>
              </div>

              {player.teamMemberships.length > 1 ? (
                <div className="mt-4 space-y-3">
                  <p className="font-medium text-slate-900">Additional team views</p>
                  {player.teamMemberships.slice(1).map((membership) => (
                    <div key={membership.id} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-slate-700">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{membership.teamName}</p>
                          <p className="mt-1">{membership.division} · {membership.season}</p>
                        </div>
                        <StatusBadge label={membership.accessLevel} />
                      </div>
                      <p className="mt-3">{membership.notes}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Player permissions">
            <div className="space-y-4 text-sm">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-slate-700">
                <p className="font-medium">Allowed</p>
                <ul className="mt-2 space-y-2">
                  <li>Print the current game roster</li>
                  <li>View personal registration and account details</li>
                  <li>See active or expired game-pass status</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-slate-700">
                <p className="font-medium">Not allowed</p>
                <ul className="mt-2 space-y-2">
                  <li>Manage team roster membership</li>
                  <li>Edit lineup roles</li>
                  <li>Use captain-only team management tools</li>
                </ul>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Game roster access">
            <div className="space-y-3 text-sm">
              <p className="text-slate-600">Logged-in players can print the game roster, but they should not be able to manage the team.</p>
              <Button className="w-full">Print game roster</Button>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-600">
                <p className="font-medium text-slate-900">Player print flow</p>
                <ol className="mt-2 list-decimal space-y-1 pl-5">
                  <li>Open the upcoming match roster</li>
                  <li>Review active team and game-pass eligibility</li>
                  <li>Print a read-only game roster copy</li>
                </ol>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-600">
                Team management stays in the captain experience only.
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Game pass status">
            <div className="space-y-4 text-sm">
              {activeGamePass ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-slate-700">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">Active game pass</p>
                      <p className="mt-1">{activeGamePass.label}</p>
                    </div>
                    <StatusBadge label={activeGamePass.status} />
                  </div>
                  <p className="mt-3 text-sm">Roster scope: {activeGamePass.rosterScope}. After the game ends, this player should drop off the roster automatically.</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 p-4 text-slate-600">
                  No active game-pass access right now.
                </div>
              )}

              {expiredGamePasses.length > 0 ? (
                <div className="rounded-2xl border border-slate-200 p-4 text-slate-600">
                  <p className="font-medium text-slate-900">Expired game passes</p>
                  <ul className="mt-3 space-y-2">
                    {expiredGamePasses.map((pass) => (
                      <li key={pass.id} className="flex items-center justify-between gap-3">
                        <span>{pass.label}</span>
                        <StatusBadge label={pass.status} />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </SectionCard>
        </div>
      </div>
    </PrototypeShell>
  );
}
