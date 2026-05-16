import { PrototypeShell, SectionCard, StatCard, StatusBadge } from "@/components/prototype-shell";
import { Button } from "@/components/ui/button";
import { BodyCell, BodyRow, DataTable, HeadCell, TableBody, TableHead, TableWrap } from "@/components/ui/table";
import { captainRoster, matches, teams } from "@/lib/mock-data";

export default function CaptainTeamPage() {
  const team = teams[0];

  return (
    <PrototypeShell
      role="captain"
      title="Manage team"
      subtitle="Captain-facing team management view for roster, communications, and match preparation."
    >
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Team" value={team.name} note={team.division} />
        <StatCard label="Record" value={team.record} note="Current season" />
        <StatCard label="Roster size" value={String(team.rosterSize)} note="Approved players" />
        <StatCard label="Next match" value={team.nextMatch} note="Upcoming fixture" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard title="Roster management">
          <TableWrap>
            <DataTable>
              <TableHead>
                <tr>
                  <HeadCell>Player</HeadCell>
                  <HeadCell>Jersey</HeadCell>
                  <HeadCell>Status</HeadCell>
                  <HeadCell>Captain Tools</HeadCell>
                </tr>
              </TableHead>
              <TableBody>
                {captainRoster.map((player) => (
                  <BodyRow key={player.id}>
                    <BodyCell className="font-medium">{player.name}</BodyCell>
                    <BodyCell>#{player.jersey}</BodyCell>
                    <BodyCell><StatusBadge label={player.status} /></BodyCell>
                    <BodyCell className="text-sky-700">Edit lineup role</BodyCell>
                  </BodyRow>
                ))}
              </TableBody>
            </DataTable>
          </TableWrap>
        </SectionCard>

        <SectionCard title="Captain actions">
          <div className="space-y-3">
            <Button className="w-full">Print game roster</Button>
            <Button variant="secondary" className="w-full">Manage lineup</Button>
            <Button variant="secondary" className="w-full">Open match roster</Button>
            <Button variant="secondary" className="w-full">Send team update</Button>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-medium text-slate-900">Captain print flow</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>Open the match roster</li>
                <li>Confirm season players and single-match game-pass players</li>
                <li>Remove expired pass entries automatically</li>
                <li>Print the final roster from the front end</li>
              </ol>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-slate-700">
              These are captain-only tools. Normal logged-in players should be able to print the roster, but not manage team membership or lineup controls.
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="mt-6">
        <SectionCard title="Upcoming fixtures">
          <div className="space-y-4">
            {matches.map((match) => (
              <div key={match.id} className="flex items-center justify-between rounded-2xl border border-slate-200 p-4 text-sm">
                <div>
                  <p className="font-medium">{match.home} vs {match.away}</p>
                  <p className="text-slate-500">{match.startsAt} · {match.field}</p>
                </div>
                <StatusBadge label={match.status} />
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </PrototypeShell>
  );
}
