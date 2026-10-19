import { PageHeading } from "@/components/league";
import { Badge, MatchStatusBadge } from "@/components/ui/badge";
import { BodyCell, BodyRow, DataTable, HeadCell, RowLink, TableBody, TableHead, TableWrap } from "@/components/ui/table";
import { listMatches, reportOverdue } from "@/lib/queries/matches";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { ArchivedNotice, param, seasonFrom, withSeason, type SearchParams } from "../_components/season";
import { DoneNotice } from "../_components/done-notice";
import { DivisionFilter } from "../_components/division-filter";
import { listDivisions } from "@/lib/queries/admin-league";

export const metadata = { title: "Matches" };

export default async function MatchesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const season = await seasonFrom(sp);
  const divisions = await listDivisions(season.id);
  const picked = divisions.find((d) => d.code === param(sp.division));
  const rows = [...(await listMatches(season.id, { divisionId: picked?.id }))].sort((a, b) => b.gameNumber - a.gameNumber);
  return (
    <>
      <PageHeading
        title="Matches"
        sub={`${season.name} schedule${picked ? ` · ${picked.name}` : ""} · ${rows.length} matches`}
        actions={
          <>
            <DivisionFilter divisions={divisions} value={picked?.code ?? ""} />
            {season.archived ? null : (
              <ButtonLink href={withSeason(picked ? `/admin/matches/new?division=${picked.code}` : "/admin/matches/new", season)} variant="primary" size="sm">
                <Icon name="plus" className="size-4" />
                New match
              </ButtonLink>
            )}
          </>
        }
      />
      <ArchivedNotice season={season} />
      <DoneNotice done={param(sp.done)} what={param(sp.what)} />
      {rows.length ? (
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
                const refs = m.refsAssigned;
                const report = m.reportStatus === "OVERDUE" || reportOverdue(m.scheduledAt, m.reportStatus) ? "OVERDUE" : m.reportStatus;
                return (
                  <BodyRow key={m.id}>
                    <BodyCell className="font-mono">
                      <RowLink href={withSeason(`/admin/matches/${m.gameNumber}`, season)}>#{m.gameNumber}</RowLink>
                    </BodyCell>
                    <BodyCell className="whitespace-nowrap">
                      {m.date}
                      <div className="text-xs text-muted">{m.time}</div>
                    </BodyCell>
                    <BodyCell className="whitespace-nowrap">
                      <b>{m.homeTeam.name}</b>
                      <div className="text-[13px] text-muted">vs {m.awayTeam.name}</div>
                    </BodyCell>
                    <BodyCell className="whitespace-nowrap">{m.field}</BodyCell>
                    <BodyCell className="text-[13px] whitespace-nowrap">{m.division?.name ?? m.homeTeam.division.name}</BodyCell>
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
                      <MatchStatusBadge status={report} />
                    </BodyCell>
                  </BodyRow>
                );
              })}
            </TableBody>
          </DataTable>
        </TableWrap>
      ) : (
        <EmptyState icon="cal" title={picked ? `No ${picked.name} matches yet` : `No matches in ${season.name} yet`} />
      )}
    </>
  );
}
