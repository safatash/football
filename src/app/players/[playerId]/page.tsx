import type { Metadata } from "next";
import { getBrand } from "@/lib/branding";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Crest } from "@/components/league";
import { Card, EmptyState } from "@/components/ui/card";
import { BodyCell, BodyRow, DataTable, HeadCell, TableBody, TableHead, TableWrap } from "@/components/ui/table";
import { PlayerFace, PublicFrame } from "@/components/public";
import { SuspendedBadge, ViewerProvider } from "@/components/public/viewer";
import { publicPlayer, resolvePublicSeason } from "@/lib/queries/public";

export const revalidate = 60;

type Params = Promise<{ playerId: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { playerId } = await params;
  const { active } = await resolvePublicSeason(null);
  const p = await publicPlayer(playerId, active?.id ?? null);
  if (!p) return { title: "Player" };
  const b = await getBrand();
  return {
    title: p.name,
    description: `${p.name}${p.current ? ` plays for ${p.current.team.name}` : ""} in ${b.name}: teams and stats by season.`,
    alternates: { canonical: `/players/${p.id}` },
  };
}

/** Public player page: name, position, current team, history. Never contact details, DOB or age. */
export default async function PlayerPage({ params }: { params: Params }) {
  const { playerId } = await params;
  const { active } = await resolvePublicSeason(null);
  const p = await publicPlayer(playerId, active?.id ?? null);
  if (!p) notFound();

  return (
    <PublicFrame>
      <ViewerProvider teamIds={p.current ? [p.current.team.id] : []}>
        <Card className="flex flex-wrap items-center gap-4">
          <PlayerFace name={p.name} photoUrl={p.photoUrl} size="lg" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="eyebrow">Player</span>
            <h1 className="text-[32px] lg:text-[40px]">{p.name}</h1>
            <span className="flex flex-wrap items-center gap-2 text-muted">
              {p.position || "Position not set"}
              <SuspendedBadge playerId={p.id} />
            </span>
          </div>
          {p.current ? (
            <Link href={`/teams/${p.current.team.id}`} className="flex items-center gap-2.5 rounded-[var(--radius-field)] bg-surface-2 px-3.5 py-2.5 hover:bg-surface-3">
              <Crest team={p.current.team} />
              <span>
                <b className="block">{p.current.team.name}</b>
                <span className="text-xs text-muted">
                  {p.current.team.division.name}
                  {p.current.jerseyNumber != null ? ` · #${p.current.jerseyNumber}` : ""}
                </span>
              </span>
            </Link>
          ) : null}
        </Card>
      </ViewerProvider>

      <section className="flex flex-col gap-2.5" aria-labelledby="history-h">
        <h2 id="history-h" className="text-[26px]">
          Teams played
        </h2>
        {p.history.length ? (
          <TableWrap>
            <DataTable className="text-sm">
              <caption className="sr-only">{`${p.name}'s teams and stats by season`}</caption>
              <TableHead>
                <tr>
                  <HeadCell>Season</HeadCell>
                  <HeadCell>Team</HeadCell>
                  <HeadCell>Division</HeadCell>
                  <HeadCell align="right">GP</HeadCell>
                  <HeadCell align="right">G</HeadCell>
                  <HeadCell align="right">A</HeadCell>
                </tr>
              </TableHead>
              <TableBody>
                {p.history.map((h) => (
                  <BodyRow key={h.team.id}>
                    <BodyCell className="whitespace-nowrap">{h.team.season.name}</BodyCell>
                    <BodyCell className="min-w-[180px]">
                      <Link href={`/teams/${h.team.id}`} className="flex items-center gap-2 font-bold hover:underline">
                        <Crest team={h.team} />
                        {h.team.name}
                      </Link>
                    </BodyCell>
                    <BodyCell className="whitespace-nowrap">{h.team.division.name}</BodyCell>
                    <BodyCell align="right">{h.stats.gp}</BodyCell>
                    <BodyCell align="right" className="font-bold">
                      {h.stats.goals}
                    </BodyCell>
                    <BodyCell align="right">{h.stats.assists}</BodyCell>
                  </BodyRow>
                ))}
              </TableBody>
            </DataTable>
          </TableWrap>
        ) : (
          <EmptyState icon="users" title="No team history yet" />
        )}
      </section>
    </PublicFrame>
  );
}
