import { Crest, PageHeading } from "@/components/league";
import { BodyCell, BodyRow, DataTable, HeadCell, RowLink, TableBody, TableHead, TableWrap } from "@/components/ui/table";
import { DIVISIONS, TEAMS, division, points } from "@/lib/league-data";
import { seasonFrom, withSeason, type SearchParams } from "../_components/season";

export const metadata = { title: "Teams" };

export default async function TeamsPage({ searchParams }: { searchParams: SearchParams }) {
  const season = seasonFrom(await searchParams);
  return (
    <>
      <PageHeading title="Teams" sub={`${TEAMS.length} teams in ${DIVISIONS.length} divisions`} />
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
            {TEAMS.map((t) => (
              <BodyRow key={t.id}>
                <BodyCell>
                  <span className="flex items-center gap-2.5 whitespace-nowrap">
                    <Crest teamId={t.id} />
                    <RowLink href={withSeason(`/admin/teams/${t.id}`, season)}>{t.name}</RowLink>
                  </span>
                </BodyCell>
                <BodyCell className="whitespace-nowrap">{division(t.div).name}</BodyCell>
                <BodyCell align="center" className="tabular-nums">
                  {t.w}-{t.d}-{t.l}
                </BodyCell>
                <BodyCell align="right">
                  <b>{points(t)}</b>
                </BodyCell>
                <BodyCell align="right" className="tabular-nums">
                  {t.size}
                </BodyCell>
                <BodyCell className="text-[13px] whitespace-nowrap">{t.caps.join(", ")}</BodyCell>
              </BodyRow>
            ))}
          </TableBody>
        </DataTable>
      </TableWrap>
    </>
  );
}
