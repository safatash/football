import { notFound } from "next/navigation";
import { getPlacement, listDivisions, placementTeams } from "@/lib/queries/placements";
import { ArchivedNotice, Crumbs, seasonFrom, withSeason, type SearchParams } from "../../_components/season";
import { PlacementDetail } from "./placement-detail";

export const metadata = { title: "Placement" };

export default async function PlacementDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  const season = await seasonFrom(await searchParams);
  const placement = await getPlacement(id, season);
  if (!placement) notFound();
  const [divisions, teams] = await Promise.all([listDivisions(season.id), placementTeams(season.id)]);
  return (
    <PlacementDetail
      placement={placement}
      divisions={divisions}
      teams={teams}
      readOnly={season.archived}
      crumbs={<Crumbs items={[["Placement queue", withSeason("/admin/placements", season)], [placement.name]]} />}
      notice={<ArchivedNotice season={season} />}
    />
  );
}
