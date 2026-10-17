import { Crest, PageHeading, PosTag } from "@/components/league";
import { EmptyState } from "@/components/ui/card";
import { BodyCell, BodyRow, DataTable, HeadCell, RowLink, TableBody, TableHead, TableWrap } from "@/components/ui/table";
import { PLACEMENTS, division, team } from "@/lib/league-data";
import { ArchivedNotice, seasonFrom, withSeason, type SearchParams } from "../_components/season";
import { PlacementBadge } from "./placement-badge";

export const metadata = { title: "Placement queue" };

export default async function PlacementsPage({ searchParams }: { searchParams: SearchParams }) {
  const season = seasonFrom(await searchParams);
  return (
    <>
      <PageHeading title="Placement queue" sub="New players without a team. Assign a division and team, waitlist, or ask for more info." />
      <ArchivedNotice season={season} />
      {PLACEMENTS.length ? (
        <TableWrap>
          <DataTable>
            <TableHead>
              <tr>
                <HeadCell>Player</HeadCell>
                <HeadCell>Division</HeadCell>
                <HeadCell>Level</HeadCell>
                <HeadCell>Position</HeadCell>
                <HeadCell align="right">Age</HeadCell>
                <HeadCell>Status</HeadCell>
                <HeadCell>Suggested team</HeadCell>
              </tr>
            </TableHead>
            <TableBody>
              {PLACEMENTS.map((p) => (
                <BodyRow key={p.id}>
                  <BodyCell className="min-w-[150px]">
                    <RowLink href={withSeason(`/admin/placements/${p.id}`, season)}>{p.name}</RowLink>
                    <div className="text-xs text-muted">{p.city}</div>
                  </BodyCell>
                  <BodyCell className="whitespace-nowrap">{division(p.div).name}</BodyCell>
                  <BodyCell className="whitespace-nowrap">{p.level}</BodyCell>
                  <BodyCell>
                    <PosTag pos={p.pos} />
                  </BodyCell>
                  <BodyCell align="right">{p.age}</BodyCell>
                  <BodyCell>
                    <PlacementBadge state={p.state} />
                  </BodyCell>
                  <BodyCell>
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      <Crest teamId={p.rec.team} />
                      {team(p.rec.team).name}
                    </span>
                  </BodyCell>
                </BodyRow>
              ))}
            </TableBody>
          </DataTable>
        </TableWrap>
      ) : (
        <EmptyState icon="users" title="No players waiting">
          New players without a team will show up here.
        </EmptyState>
      )}
    </>
  );
}
