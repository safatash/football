/**
 * Division eligibility. Everyone must be at least `minAge` on the season's opening day and born
 * on or before the cutoff for their gender. Women-only and men-only divisions take that gender
 * only; non-binary players may register for coed divisions using the stricter (male) cutoff.
 */
export type GenderValue = "MALE" | "FEMALE" | "NON_BINARY";
export type DivisionRule = {
  genderRule: "WOMEN" | "MEN" | "COED";
  maleBornOnOrBefore: Date | null;
  femaleBornOnOrBefore: Date | null;
  minAge: number;
};

const ymd = (d: Date | string) => (typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10));

/** Whole years between a date of birth and a day (both calendar dates). */
export function ageOn(dob: Date | string, on: Date | string): number | null {
  const [a, b] = [ymd(dob), ymd(on)];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b)) return null;
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  let years = by - ay;
  if (bm < am || (bm === am && bd < ad)) years--;
  return years;
}

export function checkEligibility(
  division: DivisionRule,
  player: { dob: Date | string; gender: GenderValue },
  openingDay: Date | string,
): { ok: true } | { ok: false; reason: string } {
  const { gender } = player;
  if (division.genderRule === "WOMEN" && gender !== "FEMALE") return { ok: false, reason: "Women only" };
  if (division.genderRule === "MEN" && gender !== "MALE") return { ok: false, reason: "Men only" };

  const age = ageOn(player.dob, openingDay);
  if (age === null) return { ok: false, reason: "Enter a valid date of birth" };
  if (age < division.minAge) return { ok: false, reason: `Must be ${division.minAge}+` };

  const cutoff = gender === "FEMALE" ? division.femaleBornOnOrBefore : division.maleBornOnOrBefore;
  if (cutoff && ymd(player.dob) > ymd(cutoff)) return { ok: false, reason: "Born after cutoff" };
  return { ok: true };
}
