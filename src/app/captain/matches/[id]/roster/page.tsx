import { PrototypeShell, SectionCard, StatusBadge } from "@/components/prototype-shell";
import { Button } from "@/components/ui/button";
import { BodyCell, BodyRow, DataTable, HeadCell, TableBody, TableHead, TableWrap } from "@/components/ui/table";
import { matchRosterPool, matches } from "@/lib/mock-data";

export default async function CaptainMatchRosterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const match = matches.find((item) => item.id === id) ?? matches[0];
  const playerPool = matchRosterPool.filter((player) => player.matchId === match.id && player.passStatus !== "Expired after match");
  const expiredPasses = matchRosterPool.filter((player) => player.matchId === match.id && player.passStatus === "Expired after match");

  return (
    <PrototypeShell
      role="captain"
      title={`Match roster · Game #${match.gameNumber}`}
      subtitle="Finalize who is available, who is active, and who is on a game pass."
    >
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard title="Available player pool">
          <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            This roster only includes players eligible for Game #{match.gameNumber}. Single-match players can appear here only while their pass is active for this match day.
          </div>
          <TableWrap>
            <DataTable>
              <TableHead>
                <tr>
                  <HeadCell>Player</HeadCell>
                  <HeadCell>Jersey</HeadCell>
                  <HeadCell>Availability</HeadCell>
                  <HeadCell>Game Pass</HeadCell>
                  <HeadCell>Roster Scope</HeadCell>
                </tr>
              </TableHead>
              <TableBody>
                {playerPool.map((player) => (
                  <BodyRow key={player.id}>
                    <BodyCell className="font-medium">{player.name}</BodyCell>
                    <BodyCell>#{player.jersey}</BodyCell>
                    <BodyCell><StatusBadge label={player.availability} /></BodyCell>
                    <BodyCell><StatusBadge label={player.gamePass ? "Yes" : "No"} /></BodyCell>
                    <BodyCell>{player.rosterScope}</BodyCell>
                  </BodyRow>
                ))}
              </TableBody>
            </DataTable>
          </TableWrap>
        </SectionCard>

        <SectionCard title="Roster completion">
          <div className="space-y-4 text-sm">
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-slate-500">Selected players</p>
              <p className="mt-2 text-2xl font-semibold">14 / 18</p>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-slate-500">Warnings</p>
              <p className="mt-2">1 unavailable player still included, 1 active game pass attached to this match. Expired game-pass entries should never remain in the selectable pool after the game ends.</p>
            </div>
            {expiredPasses.length > 0 ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-slate-700">
                <p className="font-medium">Expired game-pass entries removed</p>
                <ul className="mt-3 space-y-2">
                  {expiredPasses.map((player) => (
                    <li key={player.id} className="flex items-center justify-between gap-3">
                      <span>{player.name}</span>
                      <StatusBadge label={player.passStatus} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-600">
              <p className="font-medium text-slate-900">Match-day print checklist</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                <li>Verify all season-roster players for this specific game</li>
                <li>Confirm active single-match players are still valid for today</li>
                <li>Remove expired passes from the active pool</li>
                <li>Save, finalize, then print the game roster</li>
              </ol>
            </div>
            <Button className="w-full">Save roster draft</Button>
            <Button variant="success" className="w-full">Finalize match roster</Button>
            <Button variant="secondary" className="w-full">Print final game roster</Button>
          </div>
        </SectionCard>
      </div>
    </PrototypeShell>
  );
}
