import Link from "next/link";
import { PageHeading } from "@/components/league";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { BodyCell, BodyRow, DataTable, HeadCell, RowLink, TableBody, TableHead, TableWrap } from "@/components/ui/table";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { ageLabel, genderLabel, listDivisions } from "@/lib/queries/admin-league";
import { ArchivedNotice, param, seasonFrom, withSeason, type SearchParams } from "../_components/season";
import { DoneNotice } from "../_components/done-notice";
import { CopyDivisionsButton } from "../_components/structure-forms";

export const metadata = { title: "Divisions" };

export default async function DivisionsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const season = await seasonFrom(sp);
  const [divisions, teamCounts, playerCounts, others] = await Promise.all([
    listDivisions(season.id),
    db.team.groupBy({ by: ["divisionId"], where: { seasonId: season.id }, _count: { _all: true } }),
    db.teamRoster.groupBy({ by: ["divisionId"], where: { team: { seasonId: season.id }, leftAt: null, membershipType: "SEASONAL" }, _count: { _all: true } }),
    season.archived
      ? []
      : db.season.findMany({
          where: { id: { not: season.id }, divisions: { some: {} } },
          select: { id: true, name: true, divisions: { select: { name: true }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }] } },
          orderBy: { startDate: "desc" },
        }),
  ]);
  const teams = new Map(teamCounts.map((t) => [t.divisionId, t._count._all]));
  const players = new Map(playerCounts.map((t) => [t.divisionId, t._count._all]));
  const seasonQ = season.isActive ? "" : `season=${encodeURIComponent(season.name)}`;
  const sources = others.map((s) => ({ id: s.id, name: s.name, divisions: s.divisions.map((d) => d.name) }));
  const copy = (primary?: boolean) => <CopyDivisionsButton toSeasonId={season.id} toSeasonName={season.name} sources={sources} seasonQuery={seasonQ} primary={primary} />;
  return (
    <>
      <PageHeading
        title="Divisions"
        sub={`${season.name} · fees, age rules and who can play`}
        actions={
          season.archived ? null : (
            <div className="flex flex-wrap gap-2">
              {divisions.length ? copy() : null}
              <ButtonLink href={`/admin/divisions/new${seasonQ ? `?${seasonQ}` : ""}`} variant="primary" size="sm">
                <Icon name="plus" className="size-4" />
                New division
              </ButtonLink>
            </div>
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
                <HeadCell>Status</HeadCell>
                <HeadCell>Who</HeadCell>
                <HeadCell>Age rule</HeadCell>
                <HeadCell align="right">Fee</HeadCell>
                <HeadCell align="right">Teams</HeadCell>
                <HeadCell align="right">Players</HeadCell>
                <HeadCell align="right">
                  <span className="sr-only">Edit</span>
                </HeadCell>
              </tr>
            </TableHead>
            <TableBody>
              {divisions.map((d) => {
                const n = teams.get(d.id) ?? 0;
                return (
                  <BodyRow key={d.id}>
                    <BodyCell className="whitespace-nowrap">
                      <RowLink href={withSeason(`/admin/divisions/${d.code}`, season)}>{d.name}</RowLink>
                      {d.level ? <div className="text-xs text-muted">{d.level}</div> : null}
                    </BodyCell>
                    <BodyCell>{d.status === "ACTIVE" ? <Badge tone="ok">Active</Badge> : <Badge>Inactive</Badge>}</BodyCell>
                    <BodyCell className="text-[13px] whitespace-nowrap">{genderLabel(d)}</BodyCell>
                    <BodyCell className="text-[13px]">
                      <Badge dot={false}>{ageLabel(d, season.startDate)}</Badge>
                    </BodyCell>
                    <BodyCell align="right">{money(d.registrationFee)}</BodyCell>
                    <BodyCell align="right" className="whitespace-nowrap">
                      {n}
                      {d.maxTeams != null ? <span className="text-muted"> / {d.maxTeams}</span> : null}
                    </BodyCell>
                    <BodyCell align="right">{players.get(d.id) ?? 0}</BodyCell>
                    <BodyCell align="right" className="relative z-[1]">
                      {season.archived ? null : (
                        <Link href={`/admin/divisions/${d.code}/edit${seasonQ ? `?${seasonQ}` : ""}`} className="text-[13.5px] font-bold text-pitch-2 underline underline-offset-4 dark:text-lime">
                          Edit
                        </Link>
                      )}
                    </BodyCell>
                  </BodyRow>
                );
              })}
            </TableBody>
          </DataTable>
        </TableWrap>
      ) : (
        <EmptyState
          icon="list"
          title={`No divisions in ${season.name} yet`}
          action={
            season.archived ? undefined : (
              <div className="flex flex-wrap justify-center gap-2">
                {copy(true)}
                <ButtonLink href={`/admin/divisions/new${seasonQ ? `?${seasonQ}` : ""}`} variant={sources.length ? "ghost" : "primary"} size="sm">
                  <Icon name="plus" className="size-4" />
                  New division
                </ButtonLink>
              </div>
            )
          }
        >
          {sources.length ? "Copy last season’s divisions, or add one from scratch." : "Add a division, then its teams."}
        </EmptyState>
      )}
    </>
  );
}
