import { notFound } from "next/navigation";
import { Crest, PageHeading } from "@/components/league";
import { EmptyState, StatCard } from "@/components/ui/card";
import { Segmented } from "@/components/ui/controls";
import { BodyCell, BodyRow, DataTable, HeadCell, TableBody, TableHead, TableWrap } from "@/components/ui/table";
import { money, fmtShortDateOnly } from "@/lib/format";
import { ageLabel, getDivisionByCode, listDivisions, ruleText } from "@/lib/queries/admin-league";
import { getSettings } from "@/lib/queries/season";
import { loadStandings, topScorers } from "@/lib/queries/standings";
import { listTeams } from "@/lib/queries/teams";
import { seasonFrom, withSeason, type SearchParams } from "../../_components/season";
import { StandingsTable } from "../../_components/standings-table";

/** "Mar 29" for a date-only column. */

export async function generateMetadata({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  const season = await seasonFrom(await searchParams);
  const d = await getDivisionByCode(season.id, id);
  return { title: d?.name ?? "Division" };
}

export default async function DivisionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  const season = await seasonFrom(await searchParams);
  const d = await getDivisionByCode(season.id, id);
  if (!d) notFound();
  const [divisions, teams, rows, scorers, settings] = await Promise.all([
    listDivisions(season.id),
    listTeams(season.id, d.id),
    loadStandings(season.id, d.id),
    topScorers(season.id, d.id),
    getSettings(season.id),
  ]);

  return (
    <>
      <PageHeading
        title={d.name}
        sub={[d.level, season.name].filter(Boolean).join(" · ")}
        actions={
          <Segmented
            label="Division"
            active={d.code}
            items={divisions.map((x) => ({ key: x.code, label: x.name.replace(" Coed", ""), href: withSeason(`/admin/divisions/${x.code}`, season) }))}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatCard label="Season" value={<span className="text-[28px]">{season.name}</span>} note={`${fmtShortDateOnly(season.startDate)} – ${fmtShortDateOnly(season.endDate)}`} />
        <StatCard label="Teams" value={teams.length} note={`${teams.reduce((a, t) => a + t.rosterSize, 0)} players`} />
        <StatCard label="Season fee" value={money(d.registrationFee)} note={`Game pass ${money(settings.gamePassFee)}`} />
        <StatCard label="Age rule" value={<span className="block text-xl leading-[1.2]">{ageLabel(d, season.startDate)}</span>} note={ruleText(d, season.startDate)} />
      </div>

      <div className="grid gap-[18px] lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="flex min-w-0 flex-col gap-2.5">
          <h2 className="text-[26px]">Standings</h2>
          <StandingsTable rows={rows} linkBase="/admin/teams" href={(h) => withSeason(h, season)} />
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
                  {scorers.map((p) => (
                    <BodyRow key={p.playerId}>
                      <BodyCell>
                        <span className="flex items-center gap-2">
                          {p.team ? <Crest team={p.team} /> : null}
                          <span>
                            <b>{p.name}</b>
                            {p.team ? <div className="text-xs text-muted">{p.team.name}</div> : null}
                          </span>
                        </span>
                      </BodyCell>
                      <BodyCell align="right">
                        <b className="font-display text-[22px] font-extrabold">{p.goals}</b>
                      </BodyCell>
                      <BodyCell align="right">{p.assists}</BodyCell>
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
