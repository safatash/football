import { PageHeading } from "@/components/league";
import prisma from "@/lib/prisma";
import { listTeams } from "@/lib/queries/teams";
import { listDivisions } from "@/lib/queries/admin-league";
import { ArchivedNotice, Crumbs, seasonFrom, withSeason, type SearchParams } from "../../_components/season";
import { NewPlayerForm } from "./new-player-form";

export const metadata = { title: "Add player" };

export default async function NewPlayerPage({ searchParams }: { searchParams: SearchParams }) {
  const season = await seasonFrom(await searchParams);
  if (season.archived) {
    return (
      <>
        <PageHeading title="Add player" />
        <ArchivedNotice season={season} />
      </>
    );
  }
  const [teams, divisions, sizes] = await Promise.all([listTeams(season.id), listDivisions(season.id), prisma.tshirtSize.findMany({ orderBy: { displayOrder: "asc" } })]);
  const fee = new Map(divisions.map((d) => [d.id, Number(d.registrationFee)]));
  const groups = [...new Map(teams.map((t) => [t.division.id, t.division.name])).entries()].map(([id, label]) => ({
    label,
    options: teams.filter((t) => t.division.id === id).map((t) => ({ id: t.id, label: `${t.name} · ${t.rosterSize} players`, fee: fee.get(id) ?? 0 })),
  }));

  return (
    <>
      <div className="flex flex-col gap-2">
        <Crumbs items={[["Players", withSeason("/admin/players", season)], ["Add player"]]} />
        <PageHeading title="Add player" sub={`Create an account and, if you like, put them on a ${season.name} team with an approved registration.`} />
      </div>
      <NewPlayerForm teams={groups} sizes={sizes.map((s) => s.size)} seasonName={season.name} />
    </>
  );
}
