import { cache } from "react";
import type { PlacementState, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { ageOn } from "@/lib/eligibility";
import { fullName, regNumber } from "@/lib/format";
import type { SeasonRef } from "./season";
import { loadStandings } from "./standings";
import { listTeams, seasonalWhere, type TeamSummary } from "./teams";

export type PlacementLabel = "New" | "Info requested" | "Waitlisted" | "Assigned";
export const PLACEMENT_LABEL: Record<Exclude<PlacementState, "NONE">, PlacementLabel> = {
  NEW: "New",
  INFO_REQUESTED: "Info requested",
  WAITLISTED: "Waitlisted",
  ASSIGNED: "Assigned",
};
/** States that keep a player in the placement queue. */
export const QUEUE_STATES: PlacementState[] = ["NEW", "INFO_REQUESTED", "WAITLISTED"];

export const listDivisions = cache(async (seasonId: string) =>
  prisma.division.findMany({ where: { seasonId }, select: { id: true, code: true, name: true }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }] }),
);

const POSITION_AREA: Record<string, string> = { GK: "goal", DEF: "defense", MID: "midfield", FWD: "attack" };

/** Seasonal roster counts by position for every team in a division. */
const positionCounts = cache(async (seasonId: string, divisionId: string) => {
  const rows = await prisma.teamRoster.findMany({
    where: { ...seasonalWhere, divisionId, team: { seasonId } },
    select: { teamId: true, player: { select: { position: true } } },
  });
  const counts = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const m = counts.get(r.teamId) ?? new Map<string, number>();
    m.set(r.player.position, (m.get(r.player.position) ?? 0) + 1);
    counts.set(r.teamId, m);
  }
  return counts;
});

export type Recommendation = { team: TeamSummary; why: string };

/**
 * Suggested team in a division: a team short at the player's position (fewest players there)
 * when the division is uneven at that position, otherwise the smallest seasonal roster.
 * Teams at capacity are skipped unless every team is full.
 */
export async function recommendTeam(seasonId: string, divisionId: string, position: string | null): Promise<Recommendation | null> {
  const [teams, counts] = await Promise.all([listTeams(seasonId, divisionId), positionCounts(seasonId, divisionId)]);
  if (!teams.length) return null;
  const open = teams.filter((t) => t.rosterSize < t.maxPlayers);
  const pool = open.length ? open : teams;
  const bySize = (a: TeamSummary, b: TeamSummary) => a.rosterSize - b.rosterSize || a.name.localeCompare(b.name);
  const divisionName = teams[0].division.name;

  const area = position ? POSITION_AREA[position] : undefined;
  if (position && area) {
    const at = (t: TeamSummary) => counts.get(t.id)?.get(position) ?? 0;
    const fewest = Math.min(...pool.map(at));
    const most = Math.max(...pool.map(at));
    if (fewest < most) {
      const team = pool.filter((t) => at(t) === fewest).sort(bySize)[0];
      return { team, why: `${team.name} is short in ${area} (${team.rosterSize} players).` };
    }
  }
  const team = [...pool].sort(bySize)[0];
  const tied = pool.filter((t) => t.rosterSize === team.rosterSize).length > 1;
  return {
    team,
    why: tied
      ? `${team.name} is tied for the smallest roster in ${divisionName} (${team.rosterSize}).`
      : `${team.name} has the smallest roster in ${divisionName} (${team.rosterSize}).`,
  };
}

const placementSelect = {
  id: true,
  number: true,
  level: true,
  playerNote: true,
  placementState: true,
  submittedAt: true,
  division: { select: { id: true, code: true, name: true } },
  preferredTeam: { select: { id: true, name: true, divisionId: true } },
  player: { select: { firstName: true, lastName: true, dob: true, city: true, position: true } },
} satisfies Prisma.RegistrationSelect;
type PlacementRow = Prisma.RegistrationGetPayload<{ select: typeof placementSelect }>;

async function toPlacement(r: PlacementRow, season: Pick<SeasonRef, "id" | "startDate">) {
  let rec: Recommendation | null = null;
  if (r.division) {
    const preferred = r.preferredTeam?.divisionId === r.division.id ? r.preferredTeam : null;
    if (preferred) {
      const team = (await listTeams(season.id, r.division.id)).find((t) => t.id === preferred.id);
      if (team) rec = { team, why: `${team.name} is the team they asked for (${team.rosterSize} players).` };
    }
    rec ??= await recommendTeam(season.id, r.division.id, r.player.position);
  }
  return {
    id: r.id,
    number: regNumber(r.number),
    name: fullName(r.player),
    city: r.player.city,
    division: r.division,
    level: r.level || "Not sure",
    pos: r.player.position,
    age: ageOn(r.player.dob, season.startDate),
    notes: r.playerNote ?? "",
    state: PLACEMENT_LABEL[r.placementState as Exclude<PlacementState, "NONE">] ?? "New",
    rec: rec ? { teamId: rec.team.id, team: { name: rec.team.name, color: rec.team.color, shortName: rec.team.shortName }, divisionName: rec.team.division.name, why: rec.why } : null,
  };
}
export type Placement = Awaited<ReturnType<typeof toPlacement>>;

/** Players waiting for a team in a season, oldest first. */
export async function listPlacements(season: Pick<SeasonRef, "id" | "startDate">, states: PlacementState[] = QUEUE_STATES) {
  const rows = await prisma.registration.findMany({
    where: { seasonId: season.id, placementState: { in: states }, status: { notIn: ["REJECTED", "CANCELLED"] } },
    select: placementSelect,
    orderBy: [{ submittedAt: "asc" }, { number: "asc" }],
  });
  return Promise.all(rows.map((r) => toPlacement(r, season)));
}

/** One placement (any state but NONE) by registration id. */
export async function getPlacement(id: string, season: Pick<SeasonRef, "id" | "startDate">) {
  const r = await prisma.registration.findFirst({
    where: { id, seasonId: season.id, placementState: { not: "NONE" } },
    select: placementSelect,
  });
  return r ? toPlacement(r, season) : null;
}

/** Teams in a season with record and captain, for picking a placement. */
export async function placementTeams(seasonId: string) {
  const [teams, divisions] = await Promise.all([listTeams(seasonId), listDivisions(seasonId)]);
  const tables = await Promise.all(divisions.map((d) => loadStandings(seasonId, d.id)));
  const record = new Map(tables.flat().map((row) => [row.team.id, `${row.w}-${row.d}-${row.l}`]));
  return teams.map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
    shortName: t.shortName,
    divisionId: t.division.id,
    size: t.rosterSize,
    record: record.get(t.id) ?? "0-0-0",
    captain: t.captains[0] ?? null,
  }));
}
export type PlacementTeam = Awaited<ReturnType<typeof placementTeams>>[number];
