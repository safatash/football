/** Data for the admin create/edit forms (seasons, divisions, teams, matches). */
import prisma from "@/lib/prisma";
import { fullName } from "@/lib/format";
import { isSeasonClosed } from "./season";

/** Seasons that can still change (active, upcoming, or not yet over), newest first. */
export async function editableSeasons() {
  const seasons = await prisma.season.findMany({ select: { id: true, name: true, isActive: true, endDate: true }, orderBy: { startDate: "desc" } });
  return seasons.filter((s) => !isSeasonClosed(s)).map((s) => ({ id: s.id, name: s.name }));
}

export async function formDivisions(seasonIds: string[]) {
  return prisma.division.findMany({ where: { seasonId: { in: seasonIds } }, select: { id: true, name: true, seasonId: true }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }] });
}

export async function formTeams(seasonIds: string[]) {
  return prisma.team.findMany({ where: { seasonId: { in: seasonIds } }, select: { id: true, name: true, divisionId: true, seasonId: true, status: true }, orderBy: { name: "asc" } });
}

export async function formFields() {
  const fields = await prisma.field.findMany({ orderBy: [{ complex: "asc" }, { name: "asc" }] });
  return fields.map((f) => ({ id: f.id, label: `${f.complex} · ${/^\d+$/.test(f.name) ? `Field ${f.name}` : f.name}${f.city ? ` (${f.city})` : ""}` }));
}

/** Every player with a short hint (position and current teams) for the pickers. */
export async function pickablePlayers(seasonId: string) {
  const players = await prisma.player.findMany({
    where: { status: { not: "INACTIVE" } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      position: true,
      teamMemberships: { where: { leftAt: null, membershipType: "SEASONAL", team: { seasonId } }, select: { team: { select: { name: true } } } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  return players.map((p) => ({
    id: p.id,
    name: fullName(p),
    detail: [p.position, p.teamMemberships.map((m) => m.team.name).join(", ") || "no team this season"].filter(Boolean).join(" · "),
  }));
}
