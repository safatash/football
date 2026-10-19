import { notFound } from "next/navigation";
import { PageHeading } from "@/components/league";
import prisma from "@/lib/prisma";
import { dayKey, TZ } from "@/lib/format";
import { formDivisions, formFields, formParks, formTeams } from "@/lib/queries/admin-structure";
import { ArchivedNotice, Crumbs, seasonFrom, withSeason, type SearchParams } from "../../../_components/season";
import { MatchForm } from "../../../_components/structure-forms";

export const metadata = { title: "Edit match" };

export default async function EditMatchPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const season = await seasonFrom(sp);
  const n = Number(id);
  const m = Number.isInteger(n)
    ? await prisma.match.findUnique({ where: { seasonId_gameNumber: { seasonId: season.id, gameNumber: n } }, include: { _count: { select: { gamePasses: true } } } })
    : null;
  if (!m) notFound();
  const [divisions, teams, fields, parks] = await Promise.all([formDivisions([m.seasonId]), formTeams([m.seasonId]), formFields(m.fieldId), formParks()]);
  const time = m.scheduledAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ });
  return (
    <>
      <div className="flex flex-col gap-2">
        <Crumbs items={[["Matches", withSeason("/admin/matches", season)], [`Game #${m.gameNumber}`, withSeason(`/admin/matches/${m.gameNumber}`, season)], ["Edit"]]} />
        <PageHeading title={`Edit Game #${m.gameNumber}`} sub={season.name} />
      </div>
      {season.archived ? (
        <ArchivedNotice season={season} />
      ) : (
        <MatchForm
          seasons={[{ id: season.id, name: season.name }]}
          divisions={divisions}
          teams={teams.filter((t) => t.status !== "INACTIVE" || t.id === m.homeTeamId || t.id === m.awayTeamId)}
          fields={fields}
          parks={parks}
          seasonId={m.seasonId}
          seasonQuery={season.isActive ? "" : `season=${encodeURIComponent(season.name)}`}
          match={{
            id: m.id,
            seasonId: m.seasonId,
            divisionId: m.divisionId ?? "",
            homeTeamId: m.homeTeamId,
            awayTeamId: m.awayTeamId,
            date: dayKey(m.scheduledAt),
            time,
            fieldId: m.fieldId ?? "",
            status: m.status === "IN_PROGRESS" ? "SCHEDULED" : m.status,
            gameNumber: m.gameNumber,
            homeScore: m.homeScore,
            awayScore: m.awayScore,
            passes: m._count.gamePasses,
          }}
        />
      )}
    </>
  );
}
