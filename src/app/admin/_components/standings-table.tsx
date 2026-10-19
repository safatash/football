import { Crest } from "@/components/league";
import { BodyCell, BodyRow, DataTable, HeadCell, RowLink, TableBody, TableHead, TableWrap } from "@/components/ui/table";
import type { StandingRow } from "@/lib/standings";
import type { CrestTeam } from "@/components/league";

type StandingsTeam = CrestTeam & { id: string; code?: string | null };

/** Division table: Rank, Team, Pts, GP, W, D, L, GF, GA, GD. Rows come from `loadStandings`. */
export function StandingsTable({
  rows,
  highlight,
  linkBase = "/admin/teams",
  href,
  compact,
}: {
  rows: StandingRow<StandingsTeam>[];
  /** Team id or code to highlight. */
  highlight?: string;
  linkBase?: string | null;
  /** Builds the team link (e.g. to keep the selected season). Defaults to `${linkBase}/${code ?? id}`. */
  href?: (path: string) => string;
  /** Hides goals for/against (GD stays) for the stacked all-divisions view. */
  compact?: boolean;
}) {
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
            {compact ? null : (
              <>
                <HeadCell align="right">GF</HeadCell>
                <HeadCell align="right">GA</HeadCell>
              </>
            )}
            <HeadCell align="right">GD</HeadCell>
          </tr>
        </TableHead>
        <TableBody>
          {rows.map((r, i) => {
            const t = r.team;
            const path = `${linkBase}/${t.code ?? t.id}`;
            return (
              <BodyRow key={t.id} highlight={!!highlight && (t.id === highlight || t.code === highlight)}>
                <BodyCell align="center">
                  <b className="font-display text-xl font-extrabold">{i + 1}</b>
                </BodyCell>
                <BodyCell>
                  <span className="flex items-center gap-2.5 whitespace-nowrap">
                    <Crest team={t} />
                    {linkBase ? <RowLink href={href ? href(path) : path}>{t.name}</RowLink> : <b>{t.name}</b>}
                  </span>
                </BodyCell>
                <BodyCell align="right">
                  <b className="font-display text-[22px] font-extrabold">{r.pts}</b>
                </BodyCell>
                <BodyCell align="right">{r.played}</BodyCell>
                <BodyCell align="right">{r.w}</BodyCell>
                <BodyCell align="right">{r.d}</BodyCell>
                <BodyCell align="right">{r.l}</BodyCell>
                {compact ? null : (
                  <>
                    <BodyCell align="right">{r.gf}</BodyCell>
                    <BodyCell align="right">{r.ga}</BodyCell>
                  </>
                )}
                <BodyCell align="right">
                  <b>
                    {r.gd > 0 ? "+" : ""}
                    {r.gd}
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
