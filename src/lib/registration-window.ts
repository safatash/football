/**
 * Whether season registration is open: the league's switch (OrganizationSettings.registrationOpen),
 * an active season, and the season's optional window (inclusive league days). Pure, so the page,
 * the API and tests share one rule.
 */
import { dayKey, fmtDateOnly, isoDate } from "@/lib/format";

export type RegistrationWindowInput = {
  leagueOpen: boolean;
  season: { name: string; isActive: boolean; registrationOpensOn: Date | null; registrationClosesOn: Date | null } | null;
  at: Date;
};

export type RegistrationWindow = { open: true } | { open: false; reason: "league-closed" | "no-season" | "not-yet" | "closed"; message: string };

export function registrationWindow({ leagueOpen, season, at }: RegistrationWindowInput): RegistrationWindow {
  if (!season?.isActive) return { open: false, reason: "no-season", message: "Registration isn’t open right now. Check back when the next season opens." };
  if (!leagueOpen) return { open: false, reason: "league-closed", message: "Registration isn’t open right now. Check back soon." };
  const today = dayKey(at); // the league's calendar day
  if (season.registrationOpensOn && today < isoDate(season.registrationOpensOn)) {
    return { open: false, reason: "not-yet", message: `Registration for ${season.name} opens ${fmtDateOnly(season.registrationOpensOn)}.` };
  }
  if (season.registrationClosesOn && today > isoDate(season.registrationClosesOn)) {
    return { open: false, reason: "closed", message: `Registration for ${season.name} closed ${fmtDateOnly(season.registrationClosesOn)}.` };
  }
  return { open: true };
}
