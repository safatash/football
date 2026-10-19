import { PageHeading } from "@/components/league";
import { getActiveSeason } from "@/lib/queries/season";
import { Crumbs } from "../../_components/season";
import { SeasonForm } from "../../_components/structure-forms";

export const metadata = { title: "New season" };

export default async function NewSeasonPage() {
  const active = await getActiveSeason();
  return (
    <>
      <div className="flex flex-col gap-2">
        <Crumbs items={[["Seasons", "/admin/seasons"], ["New season"]]} />
        <PageHeading title="New season" sub="Then add its divisions, teams and matches." />
      </div>
      <SeasonForm activeName={active?.name ?? "none"} />
    </>
  );
}
