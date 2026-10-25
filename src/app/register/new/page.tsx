import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { getBrand } from "@/lib/branding";
import { AppBar, Screen } from "@/components/shell/layout";
import { db } from "@/lib/db";
import { fmtDateOnly, isoDate } from "@/lib/format";
import { ageLabel, listOpenDivisions } from "@/lib/queries/admin-league";
import { getSettings } from "@/lib/queries/season";
import { registrationRules } from "@/lib/registration";
import { listTeams } from "@/lib/queries/teams";
import { getSession } from "@/lib/session";
import { RegistrationWizard, type WizardDivision, type WizardProfile } from "./registration-wizard";

export const metadata: Metadata = { title: "Season registration" };
export const dynamic = "force-dynamic";

const GENDER = { FEMALE: "Female", MALE: "Male", NON_BINARY: "Non-binary" } as const;

export default async function NewRegistrationPage() {
  // The league's switch, an active season and the season's registration dates
  const { season, window, waiverRequired, waiverText } = await registrationRules();
  if (!window.open || !season) {
    return (
      <>
        <AppBar title="Season registration" backHref="/register" />
        <Screen>
          <EmptyState icon="cal" title="Registration isn’t open right now" action={<ButtonLink href="/" size="sm">Back to {(await getBrand()).name}</ButtonLink>}>
            {!window.open && (window.reason === "not-yet" || window.reason === "closed") ? window.message : "Check back when the next season opens."}
          </EmptyState>
        </Screen>
      </>
    );
  }

  const [divisions, teams, zips, settings, session] = await Promise.all([
    listOpenDivisions(season.id),
    listTeams(season.id),
    db.allowedZipCode.findMany({ select: { zipCode: true, county: true } }),
    getSettings(season.id),
    getSession(),
  ]);

  const playerId = session?.user?.playerId;
  const player = playerId
    ? await db.player.findUnique({ where: { id: playerId }, include: { user: { select: { email: true } } } })
    : null;
  const profile: WizardProfile | null = player
    ? {
        first: player.firstName,
        last: player.lastName,
        email: player.user.email,
        dob: isoDate(player.dob),
        gender: GENDER[player.gender],
        pos: player.position,
        shirt: player.tshirtSize,
        emergencyName: player.emergencyContactName ?? "",
        emergencyPhone: player.emergencyContactPhone ?? "",
      }
    : null;

  const wizardDivisions: WizardDivision[] = divisions.map((d) => ({
    id: d.code,
    name: d.name,
    fee: Number(d.registrationFee),
    age: ageLabel(d, season.startDate),
    genderRule: d.genderRule,
    maleBornOnOrBefore: d.maleBornOnOrBefore ? isoDate(d.maleBornOnOrBefore) : null,
    femaleBornOnOrBefore: d.femaleBornOnOrBefore ? isoDate(d.femaleBornOnOrBefore) : null,
    minAge: d.minAge,
  }));

  return (
    <RegistrationWizard
      season={{ name: season.name, openingDay: isoDate(season.startDate), openingLabel: fmtDateOnly(season.startDate) }}
      divisions={wizardDivisions}
      teams={teams.filter((t) => t.division).map((t) => ({ id: t.id, name: t.name, div: t.division.code, size: t.rosterSize }))}
      eligibleZips={zips.filter((z) => !z.county || (settings.countyAllowed && settings.eligibleCounties.includes(z.county))).map((z) => z.zipCode)}
      profile={profile}
      waiverText={waiverText}
      waiverRequired={waiverRequired}
    />
  );
}
