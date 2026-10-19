import Link from "next/link";
import { PageHeading } from "@/components/league";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BodyCell, BodyRow, DataTable, HeadCell, TableBody, TableHead, TableWrap } from "@/components/ui/table";
import { db } from "@/lib/db";
import { fmtDateOnly } from "@/lib/format";
import { isSeasonClosed } from "@/lib/queries/season";
import { param, type SearchParams } from "../_components/season";
import { DoneNotice } from "../_components/done-notice";

export const metadata = { title: "Seasons" };

export default async function SeasonsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const seasons = await db.season.findMany({
    include: { _count: { select: { divisions: true, teams: true, matches: true } } },
    orderBy: { startDate: "desc" },
  });
  return (
    <>
      <PageHeading
        title="Seasons"
        sub="Set up the next season before registration opens."
        actions={
          <ButtonLink href="/admin/seasons/new" variant="primary" size="sm">
            <Icon name="plus" className="size-4" />
            New season
          </ButtonLink>
        }
      />
      <DoneNotice done={param(sp.done)} what={param(sp.what)} />
      <TableWrap>
        <DataTable>
          <caption className="sr-only">Seasons</caption>
          <TableHead>
            <tr>
              <HeadCell>Season</HeadCell>
              <HeadCell>Opening day</HeadCell>
              <HeadCell>Last day</HeadCell>
              <HeadCell>Status</HeadCell>
              <HeadCell align="right">Divisions</HeadCell>
              <HeadCell align="right">Teams</HeadCell>
              <HeadCell align="right">Matches</HeadCell>
              <HeadCell align="right">
                <span className="sr-only">Edit</span>
              </HeadCell>
            </tr>
          </TableHead>
          <TableBody>
            {seasons.map((s) => (
              <BodyRow key={s.id}>
                <BodyCell className="font-bold whitespace-nowrap">{s.name}</BodyCell>
                <BodyCell className="whitespace-nowrap">{fmtDateOnly(s.startDate)}</BodyCell>
                <BodyCell className="whitespace-nowrap">{fmtDateOnly(s.endDate)}</BodyCell>
                <BodyCell>{s.isActive ? <Badge tone="ok">Active</Badge> : isSeasonClosed(s) ? <Badge>Over · read only</Badge> : <Badge tone="info">Upcoming</Badge>}</BodyCell>
                <BodyCell align="right">{s._count.divisions}</BodyCell>
                <BodyCell align="right">{s._count.teams}</BodyCell>
                <BodyCell align="right">{s._count.matches}</BodyCell>
                <BodyCell align="right">
                  {isSeasonClosed(s) ? null : (
                    <Link href={`/admin/seasons/${s.id}/edit`} className="text-[13.5px] font-bold text-pitch-2 underline underline-offset-4 dark:text-lime">
                      Edit
                    </Link>
                  )}
                </BodyCell>
              </BodyRow>
            ))}
          </TableBody>
        </DataTable>
      </TableWrap>
    </>
  );
}
