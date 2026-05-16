import Link from "next/link";
import { PrototypeShell, SectionCard } from "@/components/prototype-shell";
import { BodyCell, BodyRow, DataTable, HeadCell, TableBody, TableHead, TableWrap } from "@/components/ui/table";
import { standings } from "@/lib/mock-data";

export default function StandingsPage() {
  return (
    <PrototypeShell
      role="admin"
      title="Division standings"
      subtitle="A prototype standings view tied to season and division context."
    >
      <SectionCard title="Women Premier standings">
        <TableWrap>
          <DataTable>
            <TableHead>
              <tr>
                <HeadCell>Rank</HeadCell>
                <HeadCell>Team</HeadCell>
                <HeadCell>Pts</HeadCell>
                <HeadCell>GP</HeadCell>
                <HeadCell>W</HeadCell>
                <HeadCell>D</HeadCell>
                <HeadCell>L</HeadCell>
                <HeadCell>GF</HeadCell>
                <HeadCell>GA</HeadCell>
                <HeadCell>GD</HeadCell>
              </tr>
            </TableHead>
            <TableBody>
              {standings.map((row) => (
                <BodyRow key={row.id}>
                  <BodyCell>{row.rank}</BodyCell>
                  <BodyCell className="font-medium">
                    <Link href="/admin/divisions/division-1" className="text-sky-700">
                      {row.team}
                    </Link>
                  </BodyCell>
                  <BodyCell>{row.pts}</BodyCell>
                  <BodyCell>{row.gp}</BodyCell>
                  <BodyCell>{row.w}</BodyCell>
                  <BodyCell>{row.d}</BodyCell>
                  <BodyCell>{row.l}</BodyCell>
                  <BodyCell>{row.gf}</BodyCell>
                  <BodyCell>{row.ga}</BodyCell>
                  <BodyCell>{row.gd}</BodyCell>
                </BodyRow>
              ))}
            </TableBody>
          </DataTable>
        </TableWrap>
      </SectionCard>
    </PrototypeShell>
  );
}
