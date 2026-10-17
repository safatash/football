import { PageHeading } from "@/components/league";
import { Badge, MatchStatusBadge } from "@/components/ui/badge";
import { BodyCell, BodyRow, DataTable, HeadCell, RowLink, TableBody, TableHead, TableWrap } from "@/components/ui/table";
import { MATCHES, division, refsAssigned, team } from "@/lib/league-data";
import { seasonFrom, withSeason, type SearchParams } from "../_components/season";

export const metadata = { title: "Matches" };

export default async function MatchesPage({ searchParams }: { searchParams: SearchParams }) {
  const season = seasonFrom(await searchParams);
  const rows = [...MATCHES].sort((a, b) => b.id - a.id);
  return (
    <>
      <PageHeading title="Matches" sub={`${season} schedule`} />
      <TableWrap>
        <DataTable>
          <TableHead>
            <tr>
              <HeadCell>Game</HeadCell>
              <HeadCell>Date & time</HeadCell>
              <HeadCell>Match</HeadCell>
              <HeadCell>Field</HeadCell>
              <HeadCell>Division</HeadCell>
              <HeadCell align="center">Score</HeadCell>
              <HeadCell>Status</HeadCell>
              <HeadCell>Officials</HeadCell>
              <HeadCell>Report</HeadCell>
            </tr>
          </TableHead>
          <TableBody>
            {rows.map((m) => {
              const refs = refsAssigned(m);
              return (
                <BodyRow key={m.id}>
                  <BodyCell className="font-mono">
                    <RowLink href={withSeason(`/admin/matches/${m.id}`, season)}>#{m.id}</RowLink>
                  </BodyCell>
                  <BodyCell className="whitespace-nowrap">
                    {m.date.slice(5)}
                    <div className="text-xs text-muted">{m.time}</div>
                  </BodyCell>
                  <BodyCell className="whitespace-nowrap">
                    <b>{team(m.home).name}</b>
                    <div className="text-[13px] text-muted">vs {team(m.away).name}</div>
                  </BodyCell>
                  <BodyCell className="whitespace-nowrap">{m.field}</BodyCell>
                  <BodyCell className="text-[13px] whitespace-nowrap">{division(m.div).name}</BodyCell>
                  <BodyCell align="center">
                    <b className="font-display text-xl font-extrabold whitespace-nowrap">{m.score ? m.score.join("–") : "—"}</b>
                  </BodyCell>
                  <BodyCell>
                    <MatchStatusBadge status={m.status} />
                  </BodyCell>
                  <BodyCell>
                    <Badge tone={refs === 3 ? "ok" : refs ? "warn" : "bad"}>{refs} / 3</Badge>
                  </BodyCell>
                  <BodyCell>
                    <MatchStatusBadge status={m.report} />
                  </BodyCell>
                </BodyRow>
              );
            })}
          </TableBody>
        </DataTable>
      </TableWrap>
    </>
  );
}
