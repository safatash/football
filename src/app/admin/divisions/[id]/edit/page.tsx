import { notFound } from "next/navigation";
import { PageHeading } from "@/components/league";
import { isoDate } from "@/lib/format";
import { getDivisionByCode } from "@/lib/queries/admin-league";
import { getSettings } from "@/lib/queries/season";
import { ArchivedNotice, Crumbs, seasonFrom, withSeason, type SearchParams } from "../../../_components/season";
import { DivisionForm } from "../../../_components/structure-forms";

export const metadata = { title: "Edit division" };

export default async function EditDivisionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const season = await seasonFrom(sp);
  const [d, settings] = await Promise.all([getDivisionByCode(season.id, id), getSettings(season.id)]);
  if (!d) notFound();
  return (
    <>
      <div className="flex flex-col gap-2">
        <Crumbs items={[["Divisions", withSeason("/admin/divisions", season)], [d.name, withSeason(`/admin/divisions/${d.code}`, season)], ["Edit"]]} />
        <PageHeading title={`Edit ${d.name}`} sub={season.name} />
      </div>
      {season.archived ? (
        <ArchivedNotice season={season} />
      ) : (
        <DivisionForm
          seasonId={season.id}
          seasonQuery={season.isActive ? "" : `season=${encodeURIComponent(season.name)}`}
          leagueGamePassFee={settings.gamePassFee}
          division={{
            id: d.id,
            code: d.code,
            name: d.name,
            level: d.level ?? "",
            description: d.description ?? "",
            fee: Number(d.registrationFee),
            gamePassFee: d.gamePassFee == null ? null : Number(d.gamePassFee),
            status: d.status,
            genderRule: d.genderRule,
            minAge: d.minAge,
            maleCutoff: d.maleBornOnOrBefore ? isoDate(d.maleBornOnOrBefore) : "",
            femaleCutoff: d.femaleBornOnOrBefore ? isoDate(d.femaleBornOnOrBefore) : "",
            displayOrder: d.displayOrder,
            maxTeams: d.maxTeams,
            rosterMin: d.rosterMin,
            rosterMax: d.rosterMax,
          }}
        />
      )}
    </>
  );
}
