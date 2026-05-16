import { PrototypeShell, SectionCard, StatCard } from "@/components/prototype-shell";
import { BodyCell, BodyRow, DataTable, HeadCell, TableBody, TableHead, TableWrap } from "@/components/ui/table";
import { divisions, standings } from "@/lib/mock-data";

export default async function DivisionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const division = divisions.find((item) => item.id === id) ?? divisions[0];

  return (
    <PrototypeShell
      role="admin"
      title={division.name}
      subtitle="Division-level view for eligibility, standings, and scoring leaders."
    >
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Season" value={division.season} note="Current active context" />
        <StatCard label="Teams" value={String(division.teams)} note="Active team entries" />
        <StatCard label="Registration fee" value={division.registrationFee} note="Current rule set" />
        <StatCard label="Age rule" value={division.ageRule} note="Eligibility baseline" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard title="Standings snapshot">
          <TableWrap>
            <DataTable>
              <TableHead>
                <tr>
                  <HeadCell>Rank</HeadCell>
                  <HeadCell>Team</HeadCell>
                  <HeadCell>Pts</HeadCell>
                  <HeadCell>GP</HeadCell>
                  <HeadCell>GD</HeadCell>
                </tr>
              </TableHead>
              <TableBody>
                {standings.map((row) => (
                  <BodyRow key={row.id}>
                    <BodyCell>{row.rank}</BodyCell>
                    <BodyCell className="font-medium">{row.team}</BodyCell>
                    <BodyCell>{row.pts}</BodyCell>
                    <BodyCell>{row.gp}</BodyCell>
                    <BodyCell>{row.gd}</BodyCell>
                  </BodyRow>
                ))}
              </TableBody>
            </DataTable>
          </TableWrap>
        </SectionCard>

        <SectionCard title="Top scorers">
          <div className="space-y-3 text-sm">
            {division.topScorers.map((name, index) => (
              <div key={name} className="flex items-center justify-between rounded-2xl border border-slate-200 p-4">
                <span className="font-medium">#{index + 1} {name}</span>
                <span className="text-slate-500">Goals leader</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </PrototypeShell>
  );
}
