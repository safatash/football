import { Crest, PageHeading } from "@/components/league";
import { BodyCell, BodyRow, DataTable, HeadCell, RowLink, TableBody, TableHead, TableWrap } from "@/components/ui/table";
import { listDivisions } from "@/lib/queries/admin-league";
import { loadStandings } from "@/lib/queries/standings";
import { listTeams } from "@/lib/queries/teams";
import { seasonFrom, withSeason, type SearchParams } from "../_components/season";

export const metadata = { title: "Teams" };

export default async function TeamsPage({ searchParams }: { searchParams: SearchParams }) {
  const season = await seasonFrom(await searchParams);
  const [teams, divisions] = await Promise.all([listTeams(season.id), listDivisions(season.id)]);
  const tables = await Promise.all(divisions.map((d) => loadStandings(season.id, d.id)));
  const record = new Map(tables.flat().map((r) => [r.team.id, r]));
  return (
    <>
      <PageHeading title="Teams" sub={`${teams.length} teams in ${divisions.length} divisions`} />
      <TableWrap>
        <DataTable>
          <TableHead>
            <tr>
              <HeadCell>Team</HeadCell>
              <HeadCell>Division</HeadCell>
              <HeadCell align="center">W-D-L</HeadCell>
              <HeadCell align="right">Pts</HeadCell>
              <HeadCell align="right">Roster</HeadCell>
              <HeadCell>Captains</HeadCell>
            </tr>
          </TableHead>
          <TableBody>
            {teams.map((t) => {
              const r = record.get(t.id);
              return (
                <BodyRow key={t.id}>
                  <BodyCell>
                    <span className="flex items-center gap-2.5 whitespace-nowrap">
                      <Crest team={t} />
                      <RowLink href={withSeason(`/admin/teams/${t.code ?? t.id}`, season)}>{t.name}</RowLink>
                    </span>
                  </BodyCell>
                  <BodyCell className="whitespace-nowrap">{t.division.name}</BodyCell>
                  <BodyCell align="center" className="tabular-nums">
                    {r?.w ?? 0}-{r?.d ?? 0}-{r?.l ?? 0}
                  </BodyCell>
                  <BodyCell align="right">
                    <b>{r?.pts ?? 0}</b>
                  </BodyCell>
                  <BodyCell align="right" className="tabular-nums">
                    {t.rosterSize}
                  </BodyCell>
                  <BodyCell className="text-[13px] whitespace-nowrap">{t.captains.join(", ")}</BodyCell>
                </BodyRow>
              );
            })}
          </TableBody>
        </DataTable>
      </TableWrap>
    </>
  );
}
