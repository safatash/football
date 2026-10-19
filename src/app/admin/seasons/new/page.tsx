import { PageHeading } from "@/components/league";
import { getActiveSeason } from "@/lib/queries/season";
import { db } from "@/lib/db";
import { SEASON_TEMPLATES } from "@/lib/season-templates";
import { Crumbs } from "../../_components/season";
import { SeasonForm } from "../../_components/structure-forms";

export const metadata = { title: "New season" };

export default async function NewSeasonPage() {
  const [active, seasons] = await Promise.all([getActiveSeason(), db.season.count()]);
  // Offered for a league's first season
  const templates = seasons ? undefined : (["ADULT_REC", "BLANK"] as const).map((key) => ({ key, ...SEASON_TEMPLATES[key] }));
  return (
    <>
      <div className="flex flex-col gap-2">
        <Crumbs items={[["Seasons", "/admin/seasons"], ["New season"]]} />
        <PageHeading title="New season" sub="Then add its divisions, teams and matches." />
      </div>
      <SeasonForm activeName={active?.name ?? "none"} templates={templates} />
    </>
  );
}
