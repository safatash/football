import { PrototypeShell, SectionCard, StatusBadge } from "@/components/prototype-shell";
import { BodyCell, BodyRow, DataTable, HeadCell, TableBody, TableHead, TableWrap } from "@/components/ui/table";
import { captainRoster } from "@/lib/mock-data";

export default function CaptainRosterPage() {
  return (
    <PrototypeShell
      role="captain"
      title="Team roster"
      subtitle="Manage jersey numbers, availability, and match-day readiness."
    >
      <SectionCard title="Fairfax United roster">
        <TableWrap>
          <DataTable>
            <TableHead>
              <tr>
                <HeadCell>Player</HeadCell>
                <HeadCell>Jersey</HeadCell>
                <HeadCell>Status</HeadCell>
                <HeadCell>Action</HeadCell>
              </tr>
            </TableHead>
            <TableBody>
              {captainRoster.map((player) => (
                <BodyRow key={player.id}>
                  <BodyCell className="font-medium">{player.name}</BodyCell>
                  <BodyCell>#{player.jersey}</BodyCell>
                  <BodyCell><StatusBadge label={player.status} /></BodyCell>
                  <BodyCell className="text-sky-700">Edit</BodyCell>
                </BodyRow>
              ))}
            </TableBody>
          </DataTable>
        </TableWrap>
      </SectionCard>
    </PrototypeShell>
  );
}
