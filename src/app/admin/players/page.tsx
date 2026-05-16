import Link from "next/link";
import { PrototypeShell, SectionCard, StatusBadge } from "@/components/prototype-shell";
import { BodyCell, BodyRow, DataTable, HeadCell, TableBody, TableHead, TableWrap } from "@/components/ui/table";
import { players } from "@/lib/mock-data";

export default function AdminPlayersPage() {
  return (
    <PrototypeShell
      role="admin"
      title="Players"
      subtitle="Review player records, statuses, and current team placement."
    >
      <SectionCard title="Player directory">
        <TableWrap>
          <DataTable>
            <TableHead>
              <tr>
                <HeadCell>Name</HeadCell>
                <HeadCell>Email</HeadCell>
                <HeadCell>Team</HeadCell>
                <HeadCell>Division</HeadCell>
                <HeadCell>Status</HeadCell>
              </tr>
            </TableHead>
            <TableBody>
              {players.map((player) => (
                <BodyRow key={player.id}>
                  <BodyCell className="font-medium">
                    <Link href={`/admin/players/${player.id}`} className="text-sky-700">
                      {player.name}
                    </Link>
                  </BodyCell>
                  <BodyCell className="text-slate-500">{player.email}</BodyCell>
                  <BodyCell>{player.team}</BodyCell>
                  <BodyCell>{player.division}</BodyCell>
                  <BodyCell><StatusBadge label={player.status} /></BodyCell>
                </BodyRow>
              ))}
            </TableBody>
          </DataTable>
        </TableWrap>
      </SectionCard>
    </PrototypeShell>
  );
}
