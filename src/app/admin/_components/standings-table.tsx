import { Crest } from "@/components/league";
import { BodyCell, BodyRow, DataTable, HeadCell, RowLink, TableBody, TableHead, TableWrap } from "@/components/ui/table";
import { points, standings, type DivisionId } from "@/lib/league-data";

/** Division table: Rank, Team, Pts, GP, W, D, L, GF, GA, GD. */
export function StandingsTable({ division, highlight, linkBase = "/admin/teams" }: { division: DivisionId; highlight?: string; linkBase?: string | null }) {
  const rows = standings(division);
  return (
    <TableWrap>
      <DataTable>
        <TableHead>
          <tr>
            <HeadCell align="center">Rank</HeadCell>
            <HeadCell>Team</HeadCell>
            <HeadCell align="right">Pts</HeadCell>
            <HeadCell align="right">GP</HeadCell>
            <HeadCell align="right">W</HeadCell>
            <HeadCell align="right">D</HeadCell>
            <HeadCell align="right">L</HeadCell>
            <HeadCell align="right">GF</HeadCell>
            <HeadCell align="right">GA</HeadCell>
            <HeadCell align="right">GD</HeadCell>
          </tr>
        </TableHead>
        <TableBody>
          {rows.map((t, i) => {
            const gd = t.gf - t.ga;
            return (
              <BodyRow key={t.id} highlight={t.id === highlight}>
                <BodyCell align="center">
                  <b className="font-display text-xl font-extrabold">{i + 1}</b>
                </BodyCell>
                <BodyCell>
                  <span className="flex items-center gap-2.5 whitespace-nowrap">
                    <Crest teamId={t.id} />
                    {linkBase ? <RowLink href={`${linkBase}/${t.id}`}>{t.name}</RowLink> : <b>{t.name}</b>}
                  </span>
                </BodyCell>
                <BodyCell align="right">
                  <b className="font-display text-[22px] font-extrabold">{points(t)}</b>
                </BodyCell>
                <BodyCell align="right">{t.w + t.d + t.l}</BodyCell>
                <BodyCell align="right">{t.w}</BodyCell>
                <BodyCell align="right">{t.d}</BodyCell>
                <BodyCell align="right">{t.l}</BodyCell>
                <BodyCell align="right">{t.gf}</BodyCell>
                <BodyCell align="right">{t.ga}</BodyCell>
                <BodyCell align="right">
                  <b>
                    {gd > 0 ? "+" : ""}
                    {gd}
                  </b>
                </BodyCell>
              </BodyRow>
            );
          })}
        </TableBody>
      </DataTable>
    </TableWrap>
  );
}
