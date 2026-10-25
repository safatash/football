import { notFound } from "next/navigation";
import { PageHeading } from "@/components/league";
import { Notice } from "@/components/ui/card";
import { db } from "@/lib/db";
import { isoDate } from "@/lib/format";
import { getActiveSeason, isSeasonClosed } from "@/lib/queries/season";
import { Crumbs } from "../../../_components/season";
import { SeasonForm } from "../../../_components/structure-forms";

export const metadata = { title: "Edit season" };

export default async function EditSeasonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [season, active] = await Promise.all([db.season.findUnique({ where: { id } }), getActiveSeason()]);
  if (!season) notFound();
  return (
    <>
      <div className="flex flex-col gap-2">
        <Crumbs items={[["Seasons", "/admin/seasons"], [season.name]]} />
        <PageHeading title={`Edit ${season.name}`} />
      </div>
      {isSeasonClosed(season) ? (
        <Notice tone="info">{season.name} is over, so it can’t be changed.</Notice>
      ) : (
        <SeasonForm
          activeName={active?.name ?? "none"}
          season={{
            id: season.id,
            name: season.name,
            startDate: isoDate(season.startDate),
            endDate: isoDate(season.endDate),
            registrationOpensOn: season.registrationOpensOn ? isoDate(season.registrationOpensOn) : "",
            registrationClosesOn: season.registrationClosesOn ? isoDate(season.registrationClosesOn) : "",
            isActive: season.isActive,
          }}
        />
      )}
    </>
  );
}
