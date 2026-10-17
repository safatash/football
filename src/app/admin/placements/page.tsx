import { Crest, PageHeading, PosTag } from "@/components/league";
import { EmptyState } from "@/components/ui/card";
import { BodyCell, BodyRow, DataTable, HeadCell, RowLink, TableBody, TableHead, TableWrap } from "@/components/ui/table";
import { listPlacements } from "@/lib/queries/placements";
import { ArchivedNotice, seasonFrom, withSeason, type SearchParams } from "../_components/season";
import { PlacementBadge } from "./placement-badge";

export const metadata = { title: "Placement queue" };

export default async function PlacementsPage({ searchParams }: { searchParams: SearchParams }) {
  const season = await seasonFrom(await searchParams);
  const placements = await listPlacements(season);
  return (
    <>
      <PageHeading title="Placement queue" sub="New players without a team. Assign a division and team, waitlist, or ask for more info." />
      <ArchivedNotice season={season} />
      {placements.length ? (
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
              {placements.map((p) => (
                <BodyRow key={p.id}>
                  <BodyCell className="min-w-[150px]">
                    <RowLink href={withSeason(`/admin/placements/${p.id}`, season)}>{p.name}</RowLink>
                    <div className="text-xs text-muted">{p.city}</div>
                  </BodyCell>
                  <BodyCell className="whitespace-nowrap">{p.division?.name ?? "—"}</BodyCell>
                  <BodyCell className="whitespace-nowrap">{p.level}</BodyCell>
                  <BodyCell>
                    <PosTag pos={p.pos} />
                  </BodyCell>
                  <BodyCell align="right">{p.age ?? "—"}</BodyCell>
                  <BodyCell>
                    <PlacementBadge state={p.state} />
                  </BodyCell>
                  <BodyCell>
                    {p.rec ? (
                      <span className="flex items-center gap-2 whitespace-nowrap">
                        <Crest team={p.rec.team} />
                        {p.rec.team.name}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
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
