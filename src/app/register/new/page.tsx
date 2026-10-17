import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { AppBar, Screen } from "@/components/shell/layout";
import prisma from "@/lib/prisma";
import { fmtDateOnly, isoDate } from "@/lib/format";
import { ageLabel, listDivisions } from "@/lib/queries/admin-league";
import { getActiveSeason, getSettings } from "@/lib/queries/season";
import { listTeams } from "@/lib/queries/teams";
import { getSession } from "@/lib/session";
import { RegistrationWizard, type WizardDivision, type WizardProfile } from "./registration-wizard";

export const metadata: Metadata = { title: "Season registration" };
export const dynamic = "force-dynamic";

const GENDER = { FEMALE: "Female", MALE: "Male", NON_BINARY: "Non-binary" } as const;

export default async function NewRegistrationPage() {
  const season = await getActiveSeason();
  if (!season?.isActive) {
    return (
      <>
        <AppBar title="Season registration" backHref="/register" />
        <Screen>
          <EmptyState icon="cal" title="Registration isn’t open right now" action={<ButtonLink href="/" size="sm">Back to NVASA</ButtonLink>}>
            Check back when the next season opens.
          </EmptyState>
        </Screen>
      </>
    );
  }

  const [divisions, teams, zips, settings, session] = await Promise.all([
    listDivisions(season.id),
    listTeams(season.id),
    prisma.allowedZipCode.findMany({ select: { zipCode: true, fairfaxCounty: true } }),
    getSettings(season.id),
    getSession(),
  ]);

  const playerId = session?.user?.playerId;
  const player = playerId
    ? await prisma.player.findUnique({ where: { id: playerId }, include: { user: { select: { email: true } } } })
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
      eligibleZips={zips.filter((z) => settings.fairfaxCountyAllowed || !z.fairfaxCounty).map((z) => z.zipCode)}
      profile={profile}
    />
  );
}
