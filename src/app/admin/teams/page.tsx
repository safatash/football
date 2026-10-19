import { Crest, PageHeading } from "@/components/league";
import { BodyCell, BodyRow, DataTable, HeadCell, RowLink, TableBody, TableHead, TableWrap } from "@/components/ui/table";
import { listDivisions } from "@/lib/queries/admin-league";
import { loadStandings } from "@/lib/queries/standings";
import { listTeams } from "@/lib/queries/teams";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { ArchivedNotice, param, seasonFrom, withSeason, type SearchParams } from "../_components/season";
import { DoneNotice } from "../_components/done-notice";

export const metadata = { title: "Teams" };

export default async function TeamsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const season = await seasonFrom(sp);
  const [teams, divisions] = await Promise.all([listTeams(season.id), listDivisions(season.id)]);
  const tables = await Promise.all(divisions.map((d) => loadStandings(season.id, d.id)));
  const record = new Map(tables.flat().map((r) => [r.team.id, r]));
  return (
    <>
      <PageHeading
        title="Teams"
        sub={`${teams.length} teams in ${divisions.length} divisions`}
        actions={
          season.archived ? null : (
            <ButtonLink href={withSeason("/admin/teams/new", season)} variant="primary" size="sm">
              <Icon name="plus" className="size-4" />
              New team
            </ButtonLink>
          )
        }
      />
      <ArchivedNotice season={season} />
      <DoneNotice done={param(sp.done)} what={param(sp.what)} />
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
                      {t.status === "INACTIVE" ? <Badge dot={false}>Inactive</Badge> : null}
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
