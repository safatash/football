import { isoDate } from "@/lib/format";
import { blocklistEntries, extraZipCodes, genderLabel, hasSeparateCutoffs, listDiscountCodes, listDivisions } from "@/lib/queries/admin-league";
import { getSettings } from "@/lib/queries/season";
import { ArchivedNotice, seasonFrom, type SearchParams } from "../_components/season";
import { SettingsForm, type DivisionSetting } from "./settings-form";

export const metadata = { title: "Fees & eligibility" };

export default async function SettingsPage({ searchParams }: { searchParams: SearchParams }) {
  const season = await seasonFrom(await searchParams);
  const [divisionRows, settings, codes, zips, blocklist] = await Promise.all([
    listDivisions(season.id),
    getSettings(season.id),
    listDiscountCodes(season.id),
    extraZipCodes(),
    blocklistEntries(),
  ]);

  const divisions: DivisionSetting[] = divisionRows.map((d) => {
    const men = d.genderRule === "WOMEN" ? null : d.maleBornOnOrBefore;
    const women = d.genderRule === "MEN" ? null : d.femaleBornOnOrBefore;
    const separate = hasSeparateCutoffs(d);
    return {
      id: d.id,
      code: d.code,
      name: d.name,
      fee: Number(d.registrationFee),
      cutoff: separate ? null : (women ?? men) && isoDate((women ?? men)!),
      menCutoff: separate && men ? isoDate(men) : null,
      womenCutoff: separate && women ? isoDate(women) : null,
      gender: genderLabel(d),
    };
  });

  return (
    <SettingsForm
      divisions={divisions}
      gamePassFee={settings.gamePassFee}
      discountCodes={codes}
      fairfaxCountyAllowed={settings.fairfaxCountyAllowed}
      zips={zips}
      blocklist={blocklist}
      readOnly={season.archived}
      notice={<ArchivedNotice season={season} />}
    />
  );
}
