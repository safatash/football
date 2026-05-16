import Link from "next/link";
import { PrototypeShell, SectionCard, StatusBadge } from "@/components/prototype-shell";
import { BodyCell, BodyRow, DataTable, HeadCell, TableBody, TableHead, TableWrap } from "@/components/ui/table";
import { placementQueue } from "@/lib/mock-data";

export default function PlacementQueuePage() {
  return (
    <PrototypeShell
      role="admin"
      title="New player placement queue"
      subtitle="Review new-player registrations that need team assignment, waitlist handling, or division fit decisions."
    >
      <SectionCard title="Placement review queue">
        <TableWrap>
          <DataTable>
            <TableHead>
              <tr>
                <HeadCell>Player</HeadCell>
                <HeadCell>Preferred Level</HeadCell>
                <HeadCell>Desired Team</HeadCell>
                <HeadCell>Season</HeadCell>
                <HeadCell>Status</HeadCell>
                <HeadCell>Action</HeadCell>
              </tr>
            </TableHead>
            <TableBody>
              {placementQueue.map((item) => (
                <BodyRow key={item.id}>
                  <BodyCell className="font-medium">{item.playerName}</BodyCell>
                  <BodyCell>{item.preferredLevel}</BodyCell>
                  <BodyCell>{item.desiredTeam}</BodyCell>
                  <BodyCell>{item.season}</BodyCell>
                  <BodyCell><StatusBadge label={item.status} /></BodyCell>
                  <BodyCell>
                    <Link href={`/admin/placements/${item.id}`} className="font-medium text-sky-700">
                      Review
                    </Link>
                  </BodyCell>
                </BodyRow>
              ))}
            </TableBody>
          </DataTable>
        </TableWrap>
      </SectionCard>
    </PrototypeShell>
  );
}
