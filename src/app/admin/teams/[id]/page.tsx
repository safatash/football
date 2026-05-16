import { PrototypeShell, SectionCard, StatCard, StatusBadge } from "@/components/prototype-shell";
import { BodyCell, BodyRow, DataTable, HeadCell, TableBody, TableHead, TableWrap } from "@/components/ui/table";
import { captainRoster, matches, teams } from "@/lib/mock-data";

export default async function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const team = teams.find((item) => item.id === id) ?? teams[0];
  const teamMatches = matches.filter((match) => match.home === team.name || match.away === team.name);

  return (
    <PrototypeShell
      role="admin"
      title={team.name}
      subtitle="Team detail hub for roster, captains, and upcoming league activity."
    >
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Division" value={team.division} note="Current active season" />
        <StatCard label="Record" value={team.record} note={team.status} />
        <StatCard label="Roster size" value={String(team.rosterSize)} note="Approved and active players" />
        <StatCard label="Next match" value={team.nextMatch} note="Upcoming fixture" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard title="Roster overview">
          <TableWrap>
            <DataTable>
              <TableHead>
                <tr>
                  <HeadCell>Player</HeadCell>
                  <HeadCell>Jersey</HeadCell>
                  <HeadCell>Status</HeadCell>
                </tr>
              </TableHead>
              <TableBody>
                {captainRoster.map((player) => (
                  <BodyRow key={player.id}>
                    <BodyCell className="font-medium">{player.name}</BodyCell>
                    <BodyCell>#{player.jersey}</BodyCell>
                    <BodyCell><StatusBadge label={player.status} /></BodyCell>
                  </BodyRow>
                ))}
              </TableBody>
            </DataTable>
          </TableWrap>
        </SectionCard>

        <SectionCard title="Captains and status">
          <div className="space-y-4 text-sm">
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-slate-500">Captains</p>
              <p className="mt-2 font-medium">{team.captains.join(", ")}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-slate-500">Team health</p>
              <p className="mt-2 font-medium">{team.status}</p>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="mt-6">
        <SectionCard title="Schedule snapshot">
          <div className="space-y-4">
            {teamMatches.map((match) => (
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
