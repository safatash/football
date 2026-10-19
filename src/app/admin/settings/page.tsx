import { isoDate } from "@/lib/format";
import { blocklistEntries, extraZipCodes, genderLabel, hasSeparateCutoffs, leagueOfficeMembers, listDiscountCodes, listDivisions } from "@/lib/queries/admin-league";
import { getSession } from "@/lib/session";
import { LeagueOffice } from "./league-office";
import { getSettings } from "@/lib/queries/season";
import { listTeams } from "@/lib/queries/teams";
import { ArchivedNotice, seasonFrom, type SearchParams } from "../_components/season";
import { SettingsForm, type DivisionSetting } from "./settings-form";
import { DemoData } from "./demo-data";
import { demoSummary } from "@/lib/demo";

export const metadata = { title: "Fees & eligibility" };

export default async function SettingsPage({ searchParams }: { searchParams: SearchParams }) {
  const season = await seasonFrom(await searchParams);
  const [divisionRows, settings, codes, zips, blocklist, teams, members, session, demo] = await Promise.all([
    listDivisions(season.id),
    getSettings(season.id),
    listDiscountCodes(season.id),
    extraZipCodes(),
    blocklistEntries(),
    listTeams(season.id),
    leagueOfficeMembers(),
    getSession(),
    demoSummary(),
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
    <>
      <SettingsForm
        seasonId={season.id}
        teams={teams.map((t) => ({ id: t.id, name: t.name }))}
        divisions={divisions}
        gamePassFee={settings.gamePassFee}
        discountCodes={codes}
        fairfaxCountyAllowed={settings.fairfaxCountyAllowed}
        zips={zips}
        blocklist={blocklist}
        readOnly={season.archived}
        notice={<ArchivedNotice season={season} />}
        office={<LeagueOffice members={members} selfId={session?.user?.id ?? ""} />}
      />
      <DemoData teams={demo.teams} matches={demo.matches} players={demo.players} parks={demo.parks} />
    </>
  );
}
