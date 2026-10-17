import { notFound } from "next/navigation";
import { Crest, PageHeading } from "@/components/league";
import { EmptyState, StatCard } from "@/components/ui/card";
import { Segmented } from "@/components/ui/controls";
import { BodyCell, BodyRow, DataTable, HeadCell, TableBody, TableHead, TableWrap } from "@/components/ui/table";
import { DIVISIONS, GAME_PASS_FEE, TEAMS, TOP_SCORERS, money, team } from "@/lib/league-data";
import { seasonFrom, withSeason, type SearchParams } from "../../_components/season";
import { StandingsTable } from "../../_components/standings-table";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: DIVISIONS.find((d) => d.id === id)?.name ?? "Division" };
}

export default async function DivisionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  const season = seasonFrom(await searchParams);
  const d = DIVISIONS.find((x) => x.id === id);
  if (!d) notFound();
  const teams = TEAMS.filter((t) => t.div === d.id);
  const scorers = TOP_SCORERS[d.id] ?? [];

  return (
    <>
      <PageHeading
        title={d.name}
        sub={`${d.level} · ${season}`}
        actions={
          <Segmented
            label="Division"
            active={d.id}
            items={DIVISIONS.map((x) => ({ key: x.id, label: x.name.replace(" Coed", ""), href: withSeason(`/admin/divisions/${x.id}`, season) }))}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatCard label="Season" value={<span className="text-[28px]">{season}</span>} note="Mar 29 – Jun 28" />
        <StatCard label="Teams" value={teams.length} note={`${teams.reduce((a, t) => a + t.size, 0)} players`} />
        <StatCard label="Season fee" value={money(d.fee)} note={`Game pass ${money(GAME_PASS_FEE)}`} />
        <StatCard label="Age rule" value={<span className="block text-xl leading-[1.2]">{d.age}</span>} note={d.rule} />
      </div>

      <div className="grid gap-[18px] lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="flex min-w-0 flex-col gap-2.5">
          <h2 className="text-[26px]">Standings</h2>
          <StandingsTable division={d.id} linkBase="/admin/teams" />
        </section>
        <section className="flex min-w-0 flex-col gap-2.5">
          <h2 className="text-[26px]">Top scorers</h2>
          {scorers.length ? (
            <TableWrap>
              <DataTable>
                <TableHead>
                  <tr>
                    <HeadCell>Player</HeadCell>
                    <HeadCell align="right">G</HeadCell>
                    <HeadCell align="right">A</HeadCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {scorers.map(([name, t, g, a]) => (
                    <BodyRow key={name}>
                      <BodyCell>
                        <span className="flex items-center gap-2">
                          <Crest teamId={t} />
                          <span>
                            <b>{name}</b>
                            <div className="text-xs text-muted">{team(t).name}</div>
                          </span>
                        </span>
                      </BodyCell>
                      <BodyCell align="right">
                        <b className="font-display text-[22px] font-extrabold">{g}</b>
                      </BodyCell>
                      <BodyCell align="right">{a}</BodyCell>
                    </BodyRow>
                  ))}
                </TableBody>
              </DataTable>
            </TableWrap>
          ) : (
            <EmptyState icon="ball" title="No goals recorded yet">
              Scorers appear once match reports are confirmed.
            </EmptyState>
          )}
        </section>
      </div>
    </>
  );
}
