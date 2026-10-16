import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import { PrototypeShell, SectionCard, StatCard, StatusBadge } from "@/components/prototype-shell"
import { Button } from "@/components/ui/button"

export default async function PlayerDashboardPage() {
  // Get the current session
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.playerId) {
    redirect("/login")
  }

  // Fetch the player with all their data
  const player = await prisma.player.findUnique({
    where: { id: session.user.playerId },
    include: {
      user: true,
      teamMemberships: {
        where: { leftAt: null }, // Only active memberships
        include: {
          team: {
            include: {
              division: true,
              season: true,
            }
          }
        },
        orderBy: { joinedAt: 'asc' }
      },
      registrations: {
        orderBy: { submittedAt: 'desc' },
        take: 1,
        include: {
          season: true
        }
      },
      gamePasses: {
        include: {
          match: {
            include: {
              homeTeam: true,
              awayTeam: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }
    }
  })

  if (!player) {
    redirect("/login")
  }

  // Get the next upcoming match for the player's primary team
  const nextMatch = player.teamMemberships[0] ? await prisma.match.findFirst({
    where: {
      OR: [
        { homeTeamId: player.teamMemberships[0].teamId },
        { awayTeamId: player.teamMemberships[0].teamId }
      ],
      scheduledAt: { gte: new Date() },
      status: 'SCHEDULED'
    },
    include: {
      homeTeam: true,
      awayTeam: true
    },
    orderBy: { scheduledAt: 'asc' }
  }) : null

  const latestRegistration = player.registrations[0]
  const primaryMembership = player.teamMemberships[0]
  const activeGamePasses = player.gamePasses.filter(pass => pass.status === 'ACTIVE')
  const expiredGamePasses = player.gamePasses.filter(pass => pass.status === 'EXPIRED')

  // Format date helper
  const formatMatchDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(new Date(date))
  }

  return (
    <PrototypeShell
      role="player"
      title="Player dashboard"
      subtitle={`Welcome back, ${player.firstName}!`}
    >
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard 
          label="Current registration" 
          value={latestRegistration?.status || "None"} 
          note={latestRegistration?.season.name || ""} 
        />
        <StatCard 
          label="Next match" 
          value={nextMatch ? formatMatchDate(nextMatch.scheduledAt) : "None scheduled"} 
          note={nextMatch?.field || ""} 
        />
        <StatCard 
          label="Current team" 
          value={primaryMembership?.team.name || "No team"} 
          note={primaryMembership?.team.division.name || ""} 
        />
      </div>

      {latestRegistration && (
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <SectionCard title="Registration status">
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{latestRegistration.season.name}</p>
                  <p className="text-sm text-slate-500">
                    Type: {latestRegistration.registrationType.replace('_', ' ')}
                  </p>
                </div>
                <StatusBadge label={latestRegistration.status} />
              </div>
            </div>
          </SectionCard>

          {nextMatch && (
            <SectionCard title="Upcoming match">
              <div className="space-y-2 text-sm">
                <p className="font-medium">
                  {nextMatch.homeTeam.name} vs {nextMatch.awayTeam.name}
                </p>
                <p className="text-slate-500">{formatMatchDate(nextMatch.scheduledAt)}</p>
                <p className="text-slate-500">{nextMatch.field || 'Field TBD'}</p>
              </div>
            </SectionCard>
          )}
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard title="My teams">
          {player.teamMemberships.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 p-4 text-slate-600">
              No team memberships yet. Complete your registration to join a team.
            </div>
          ) : (
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
                    {membership.team.name}
                  </div>
                ))}
              </div>

              {primaryMembership && (
                <div className="rounded-2xl border border-slate-200 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-lg font-semibold">{primaryMembership.team.name}</p>
                      <p className="text-slate-500">Primary team account view</p>
                    </div>
                    <StatusBadge label={primaryMembership.membershipType} />
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-slate-500">Division</p>
                      <p className="mt-2 font-medium">{primaryMembership.team.division.name}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-slate-500">Access level</p>
                      <p className="mt-2 font-medium">
                        {primaryMembership.isCaptain ? 'Captain' : 'Player'}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-slate-500">Season</p>
                      <p className="mt-2 font-medium">{primaryMembership.team.season.name}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-slate-500">Membership type</p>
                      <p className="mt-2 font-medium">{primaryMembership.membershipType}</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
                    <p className="font-medium">Team Status</p>
                    <p className="mt-2">
                      Joined: {new Date(primaryMembership.joinedAt).toLocaleDateString()}
                      {primaryMembership.captainRequest && !primaryMembership.isCaptain && 
                        " • Captain request pending"}
                    </p>
                  </div>

                  {player.teamMemberships.length > 1 && (
                    <div className="mt-4 space-y-3">
                      <p className="font-medium text-slate-900">Additional team views</p>
                      {player.teamMemberships.slice(1).map((membership) => (
                        <div key={membership.id} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-slate-700">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-medium">{membership.team.name}</p>
                              <p className="mt-1">
                                {membership.team.division.name} · {membership.team.season.name}
                              </p>
                            </div>
                            <StatusBadge label={membership.isCaptain ? 'Captain' : 'Player'} />
                          </div>
                          <p className="mt-3">
                            {membership.membershipType} membership
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
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
              <p className="text-slate-600">
                Logged-in players can print the game roster, but they should not be able to manage the team.
              </p>
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
              {activeGamePasses.length > 0 ? (
                activeGamePasses.map(gamePass => (
                  <div key={gamePass.id} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-slate-700">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">Active game pass</p>
                        <p className="mt-1">
                          {gamePass.match.homeTeam.name} vs {gamePass.match.awayTeam.name}
                        </p>
                      </div>
                      <StatusBadge label="ACTIVE" />
                    </div>
                    <p className="mt-3 text-sm">
                      Valid until: {new Date(gamePass.validUntil).toLocaleDateString()}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-slate-200 p-4 text-slate-600">
                  No active game-pass access right now.
                </div>
              )}

              {expiredGamePasses.length > 0 && (
                <div className="rounded-2xl border border-slate-200 p-4 text-slate-600">
                  <p className="font-medium text-slate-900">Expired game passes</p>
                  <ul className="mt-3 space-y-2">
                    {expiredGamePasses.map((pass) => (
                      <li key={pass.id} className="flex items-center justify-between gap-3">
                        <span>
                          {pass.match.homeTeam.name} vs {pass.match.awayTeam.name}
                        </span>
                        <StatusBadge label="EXPIRED" />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    </PrototypeShell>
  )
}