import { notFound } from "next/navigation";
import { PLACEMENTS } from "@/lib/league-data";
import { ArchivedNotice, Crumbs, isArchived, seasonFrom, withSeason, type SearchParams } from "../../_components/season";
import { PlacementDetail } from "./placement-detail";

export const metadata = { title: "Placement" };

export default async function PlacementDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  const season = seasonFrom(await searchParams);
  const placement = PLACEMENTS.find((p) => p.id === id);
  if (!placement) notFound();
  return (
    <PlacementDetail
      placement={placement}
      readOnly={isArchived(season)}
      crumbs={<Crumbs items={[["Placement queue", withSeason("/admin/placements", season)], [placement.name]]} />}
      notice={<ArchivedNotice season={season} />}
    />
  );
}
