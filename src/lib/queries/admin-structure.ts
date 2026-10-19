/** Data for the admin create/edit forms (seasons, divisions, teams, matches). */
import prisma from "@/lib/prisma";
import { fieldName } from "@/lib/public";
import { fullName } from "@/lib/format";
import { isSeasonClosed } from "./season";

/** Seasons that can still change (active, upcoming, or not yet over), newest first. */
export async function editableSeasons() {
  const seasons = await prisma.season.findMany({ select: { id: true, name: true, isActive: true, endDate: true }, orderBy: { startDate: "desc" } });
  return seasons.filter((s) => !isSeasonClosed(s)).map((s) => ({ id: s.id, name: s.name }));
}

export async function formDivisions(seasonIds: string[]) {
  return prisma.division.findMany({ where: { seasonId: { in: seasonIds } }, select: { id: true, code: true, name: true, seasonId: true, status: true }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }] });
}

export async function formTeams(seasonIds: string[]) {
  return prisma.team.findMany({ where: { seasonId: { in: seasonIds } }, select: { id: true, name: true, divisionId: true, seasonId: true, status: true }, orderBy: { name: "asc" } });
}

/** Fields for the match form, grouped by park. Inactive fields are left out, except the match's own. */
export async function formFields(keepId?: string | null) {
  const fields = await prisma.field.findMany({
    where: { OR: [{ active: true }, ...(keepId ? [{ id: keepId }] : [])] },
    include: { park: { select: { id: true, name: true, city: true } } },
    orderBy: [{ park: { name: "asc" } }, { name: "asc" }],
  });
  return fields.map((f) => ({
    id: f.id,
    parkId: f.park.id,
    park: [f.park.name, f.park.city].filter(Boolean).join(" · "),
    label: `${fieldName(f.name)}${f.active ? "" : " (inactive)"}`,
  }));
}

/** Parks for the quick "add a field" form. */
export async function formParks() {
  return prisma.park.findMany({ select: { id: true, name: true, city: true }, orderBy: { name: "asc" } });
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
