import Link from "next/link";
import { PageHeading } from "@/components/league";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { BodyCell, BodyRow, DataTable, HeadCell, RowLink, TableBody, TableHead, TableWrap } from "@/components/ui/table";
import prisma from "@/lib/prisma";
import { money } from "@/lib/format";
import { ageLabel, genderLabel, listDivisions } from "@/lib/queries/admin-league";
import { ArchivedNotice, param, seasonFrom, withSeason, type SearchParams } from "../_components/season";
import { DoneNotice } from "../_components/done-notice";

export const metadata = { title: "Divisions" };

export default async function DivisionsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const season = await seasonFrom(sp);
  const [divisions, teamCounts] = await Promise.all([
    listDivisions(season.id),
    prisma.team.groupBy({ by: ["divisionId"], where: { seasonId: season.id }, _count: { _all: true } }),
  ]);
  const teams = new Map(teamCounts.map((t) => [t.divisionId, t._count._all]));
  const seasonQ = season.isActive ? "" : `season=${encodeURIComponent(season.name)}`;
  return (
    <>
      <PageHeading
        title="Divisions"
        sub={`${season.name} · fees, age rules and who can play`}
        actions={
          season.archived ? null : (
            <ButtonLink href={`/admin/divisions/new${seasonQ ? `?${seasonQ}` : ""}`} variant="primary" size="sm">
              <Icon name="plus" className="size-4" />
              New division
            </ButtonLink>
          )
        }
      />
      <ArchivedNotice season={season} />
      <DoneNotice done={param(sp.done)} what={param(sp.what)} />
      {divisions.length ? (
        <TableWrap>
          <DataTable>
            <caption className="sr-only">{`${season.name} divisions`}</caption>
            <TableHead>
              <tr>
                <HeadCell>Division</HeadCell>
                <HeadCell>Who</HeadCell>
                <HeadCell>Age rule</HeadCell>
                <HeadCell align="right">Fee</HeadCell>
                <HeadCell align="right">Teams</HeadCell>
                <HeadCell align="right">
                  <span className="sr-only">Edit</span>
                </HeadCell>
              </tr>
            </TableHead>
            <TableBody>
              {divisions.map((d) => (
                <BodyRow key={d.id}>
                  <BodyCell className="whitespace-nowrap">
                    <RowLink href={withSeason(`/admin/divisions/${d.code}`, season)}>{d.name}</RowLink>
                    {d.level ? <div className="text-xs text-muted">{d.level}</div> : null}
                  </BodyCell>
                  <BodyCell className="text-[13px] whitespace-nowrap">{genderLabel(d)}</BodyCell>
                  <BodyCell className="text-[13px]">
                    <Badge dot={false}>{ageLabel(d, season.startDate)}</Badge>
                  </BodyCell>
                  <BodyCell align="right">{money(d.registrationFee)}</BodyCell>
                  <BodyCell align="right">{teams.get(d.id) ?? 0}</BodyCell>
                  <BodyCell align="right" className="relative z-[1]">
                    {season.archived ? null : (
                      <Link href={`/admin/divisions/${d.code}/edit${seasonQ ? `?${seasonQ}` : ""}`} className="text-[13.5px] font-bold text-pitch-2 underline underline-offset-4 dark:text-lime">
                        Edit
                      </Link>
                    )}
                  </BodyCell>
                </BodyRow>
              ))}
            </TableBody>
          </DataTable>
        </TableWrap>
      ) : (
        <EmptyState icon="list" title={`No divisions in ${season.name} yet`}>
          Add a division, then its teams.
        </EmptyState>
      )}
    </>
  );
}
