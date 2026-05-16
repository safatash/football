import Link from "next/link";
import { PrototypeShell, SectionCard, StatusBadge } from "@/components/prototype-shell";
import { BodyCell, BodyRow, DataTable, HeadCell, TableBody, TableHead, TableWrap } from "@/components/ui/table";
import { registrations } from "@/lib/mock-data";

export default function AdminRegistrationsPage() {
  return (
    <PrototypeShell
      role="admin"
      title="Registrations"
      subtitle="Review incoming season registrations and assign players into the right lane."
    >
      <SectionCard title="Spring 2025 queue">
        <TableWrap>
          <DataTable>
            <TableHead>
              <tr>
                <HeadCell>Player</HeadCell>
                <HeadCell>Season</HeadCell>
                <HeadCell>Preferred Team</HeadCell>
                <HeadCell>Payment</HeadCell>
                <HeadCell>Status</HeadCell>
                <HeadCell>Action</HeadCell>
              </tr>
            </TableHead>
            <TableBody>
              {registrations.map((registration) => (
                <BodyRow key={registration.id}>
                  <BodyCell>
                    <p className="font-medium">{registration.playerName}</p>
                    <p className="text-slate-500">{registration.email}</p>
                  </BodyCell>
                  <BodyCell>{registration.season}</BodyCell>
                  <BodyCell>{registration.teamPreference}</BodyCell>
                  <BodyCell><StatusBadge label={registration.paymentStatus} /></BodyCell>
                  <BodyCell><StatusBadge label={registration.status} /></BodyCell>
                  <BodyCell>
                    <Link href={`/admin/registrations/${registration.id}`} className="font-medium text-sky-700">
                      Open
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
