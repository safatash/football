/**
 * Starter content for a league's first season ("Start from template"). Copied into the league
 * that picks it; it never reads another league's data.
 */
import type { DbTx } from "@/lib/db";

export const SEASON_TEMPLATES = {
  ADULT_REC: {
    label: "Adult rec league",
    description: "Five adult divisions (competitive, recreational, masters, coed) with sample fees, plus positions and shirt sizes. Edit anything afterwards.",
  },
  BLANK: { label: "Blank", description: "Just the season. Add divisions yourself." },
} as const;
export type SeasonTemplate = keyof typeof SEASON_TEMPLATES;

/** Born on or before the date `years` before opening day (age on opening day). */
const ageCutoff = (opening: Date, years: number) => new Date(Date.UTC(opening.getUTCFullYear() - years, opening.getUTCMonth(), opening.getUTCDate()));
/** Dec 31 of the year someone turns `years` this season. */
const yearEndCutoff = (opening: Date, years: number) => new Date(Date.UTC(opening.getUTCFullYear() - years, 11, 31));

const POSITIONS: [string, string][] = [
  ["Goalkeeper", "Goalkeeper"],
  ["Center Back", "Defender"],
  ["Left Back", "Defender"],
  ["Right Back", "Defender"],
  ["Defensive Midfielder", "Midfielder"],
  ["Center Midfielder", "Midfielder"],
  ["Attacking Midfielder", "Midfielder"],
  ["Left Winger", "Midfielder"],
  ["Right Winger", "Midfielder"],
  ["Striker", "Forward"],
  ["Center Forward", "Forward"],
];
const SIZES = ["Youth S", "Youth M", "Youth L", "Adult S", "Adult M", "Adult L", "Adult XL", "Adult 2XL", "Adult 3XL"];

/** Applies a template to a new season inside the season's transaction. Returns what it added. */
export async function applySeasonTemplate(tx: DbTx, template: SeasonTemplate, season: { id: string; startDate: Date }) {
  if (template === "BLANK") return { divisions: 0, positions: 0, sizes: 0 };
  const o = season.startDate;
  const adult = ageCutoff(o, 18);
  const divisions = [
    { code: "wp", name: "Women Premier", level: "Competitive", registrationFee: 95, genderRule: "WOMEN" as const, femaleBornOnOrBefore: adult, maleBornOnOrBefore: null },
    { code: "md1", name: "Men D1", level: "Competitive", registrationFee: 105, genderRule: "MEN" as const, maleBornOnOrBefore: adult, femaleBornOnOrBefore: null },
    { code: "d3", name: "D3 Coed", level: "Recreational", registrationFee: 55, genderRule: "COED" as const, maleBornOnOrBefore: yearEndCutoff(o, 18), femaleBornOnOrBefore: yearEndCutoff(o, 18) },
    { code: "mc", name: "Masters Coed", level: "Recreational", registrationFee: 45, genderRule: "COED" as const, maleBornOnOrBefore: yearEndCutoff(o, 35), femaleBornOnOrBefore: yearEndCutoff(o, 30) },
    { code: "cc", name: "Combination Coed", level: "Social to intermediate", registrationFee: 60, genderRule: "COED" as const, maleBornOnOrBefore: adult, femaleBornOnOrBefore: adult },
  ];
  for (const [i, d] of divisions.entries()) await tx.division.create({ data: { ...d, seasonId: season.id, minAge: 18, displayOrder: 10 + i } });
  // Positions and shirt sizes are league-wide: only add them if the league has none yet
  const positions = (await tx.position.count()) ? 0 : (await tx.position.createMany({ data: POSITIONS.map(([name, category]) => ({ name, category })) })).count;
  const sizes = (await tx.tshirtSize.count()) ? 0 : (await tx.tshirtSize.createMany({ data: SIZES.map((size, i) => ({ size, displayOrder: i + 1 })) })).count;
  return { divisions: divisions.length, positions, sizes };
}
