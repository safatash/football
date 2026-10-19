import { notFound } from "next/navigation";
import { Crest, PageHeading } from "@/components/league";
import { Badge, MatchStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, StatCard } from "@/components/ui/card";
import { Segmented } from "@/components/ui/controls";
import { Icon } from "@/components/ui/icon";
import { BodyCell, BodyRow, DataTable, HeadCell, RowLink, TableBody, TableHead, TableWrap } from "@/components/ui/table";
import { rosterLimitLabel, rosterWarning } from "@/lib/division-rules";
import { money, fmtShortDateOnly } from "@/lib/format";
import { ageLabel, genderLabel, getDivisionByCode, ruleText } from "@/lib/queries/admin-league";
import { listMatches } from "@/lib/queries/matches";
import { getSettings } from "@/lib/queries/season";
import { loadStandings, topScorers } from "@/lib/queries/standings";
import { listTeams } from "@/lib/queries/teams";
import { ArchivedNotice, Crumbs, param, seasonFrom, withSeason, type SearchParams } from "../../_components/season";
import { DoneNotice } from "../../_components/done-notice";
import { StandingsTable } from "../../_components/standings-table";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "teams", label: "Teams" },
  { key: "schedule", label: "Schedule" },
  { key: "standings", label: "Standings & stats" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export async function generateMetadata({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  const season = await seasonFrom(await searchParams);
  const d = await getDivisionByCode(season.id, id);
  return { title: d?.name ?? "Division" };
}

export default async function DivisionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const season = await seasonFrom(sp);
  const d = await getDivisionByCode(season.id, id);
  if (!d) notFound();
  const tab: Tab = TABS.find((t) => t.key === param(sp.tab))?.key ?? "overview";
  const [teams, rows, scorers, settings, matches] = await Promise.all([
    listTeams(season.id, d.id),
    loadStandings(season.id, d.id),
    topScorers(season.id, d.id),
    getSettings(season.id),
    listMatches(season.id, { divisionId: d.id }),
  ]);

  const base = `/admin/divisions/${d.code}`;
  const tabHref = (key: Tab) => withSeason(key === "overview" ? base : `${base}?tab=${key}`, season);
  const players = teams.reduce((a, t) => a + t.rosterSize, 0);
  // Each confirmed result counts once for each team
  const completed = rows.reduce((a, r) => a + r.played, 0) / 2;
  const record = new Map(rows.map((r) => [r.team.id, r]));
  const full = d.maxTeams != null && teams.length >= d.maxTeams;
  const editable = !season.archived;
  const gamePass = d.gamePassFee != null ? Number(d.gamePassFee) : settings.gamePassFee;

  return (
    <>
      <div className="flex flex-col gap-2">
        <Crumbs items={[["Divisions", withSeason("/admin/divisions", season)], [d.name]]} />
        <PageHeading
          title={
            <span className="flex flex-wrap items-center gap-3">
              {d.name}
              {d.status === "INACTIVE" ? <Badge>Inactive</Badge> : null}
            </span>
          }
          sub={[d.level, season.name].filter(Boolean).join(" · ")}
          actions={
            editable ? (
              <ButtonLink href={withSeason(`${base}/edit`, season)} variant="primary" size="sm">
                <Icon name="edit" className="size-4" />
                Edit division
              </ButtonLink>
            ) : null
          }
        />
      </div>
      <ArchivedNotice season={season} />
      <DoneNotice done={param(sp.done)} what={param(sp.what)} />
      <Segmented label={`${d.name} sections`} active={tab} className="lg:max-w-[640px]" items={TABS.map((t) => ({ key: t.key, label: t.label, href: tabHref(t.key) }))} />

      {tab === "overview" ? (
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          <StatCard
            label="Status"
            value={<span className="text-[28px]">{d.status === "ACTIVE" ? "Active" : "Inactive"}</span>}
            note={d.status === "ACTIVE" ? "Open for registration and game passes" : "Hidden from registration and game passes"}
          />
          <StatCard label="Teams" value={d.maxTeams != null ? `${teams.length} / ${d.maxTeams}` : teams.length} note={d.maxTeams != null ? (full ? "Full" : `${d.maxTeams - teams.length} spots left`) : "No team limit"} />
          <StatCard label="Players" value={players} note={`Roster size: ${rosterLimitLabel(d)}`} />
          <StatCard label="Season" value={<span className="text-[28px]">{season.name}</span>} note={`${fmtShortDateOnly(season.startDate)} – ${fmtShortDateOnly(season.endDate)}`} />
          <StatCard label="Registration fee" value={money(d.registrationFee)} note="Per player, for the season" />
          <StatCard
            label="Game-pass fee"
            value={money(gamePass)}
            note={d.gamePassFee != null ? `Division fee (league fee is ${money(settings.gamePassFee)})` : "League fee from Fees & eligibility"}
          />
          <StatCard label="Who can play" value={<span className="text-[28px]">{genderLabel(d)}</span>} note={d.level ?? "Level not set"} />
          <StatCard label="Age rule" value={<span className="block text-xl leading-[1.2]">{ageLabel(d, season.startDate)}</span>} note={ruleText(d, season.startDate)} />
        </div>
      ) : null}

      {tab === "teams" ? (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[26px]">Teams</h2>
            {editable ? (
              full ? (
                <span className="text-[13.5px] text-muted">Full ({d.maxTeams} teams). Raise max teams to add another.</span>
              ) : (
                <ButtonLink href={withSeason(`/admin/teams/new?division=${d.code}`, season)} variant="primary" size="sm">
                  <Icon name="plus" className="size-4" />
                  Add team
                </ButtonLink>
              )
            ) : null}
          </div>
          {teams.length ? (
            <TableWrap>
              <DataTable>
                <caption className="sr-only">{`${d.name} teams`}</caption>
                <TableHead>
                  <tr>
                    <HeadCell>Team</HeadCell>
                    <HeadCell>Status</HeadCell>
                    <HeadCell align="right">W-D-L</HeadCell>
                    <HeadCell align="right">Roster</HeadCell>
                    <HeadCell>Captains</HeadCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {teams.map((t) => {
                    const r = record.get(t.id);
                    const warn = rosterWarning(t.rosterSize, d);
                    return (
                      <BodyRow key={t.id}>
                        <BodyCell>
                          <span className="flex items-center gap-2.5">
                            <Crest team={t} />
                            <RowLink href={withSeason(`/admin/teams/${t.id}`, season)}>{t.name}</RowLink>
                          </span>
                        </BodyCell>
                        <BodyCell>{t.status === "INACTIVE" ? <Badge>Inactive</Badge> : <Badge tone="ok">Active</Badge>}</BodyCell>
                        <BodyCell align="right" className="whitespace-nowrap">
                          {r ? `${r.w}-${r.d}-${r.l}` : "0-0-0"}
                        </BodyCell>
                        <BodyCell align="right">
                          {warn ? (
                            <span title={warn}>
                              <Badge tone="warn">{t.rosterSize}</Badge>
                              <span className="sr-only">{warn}</span>
                            </span>
                          ) : (
                            t.rosterSize
                          )}
                        </BodyCell>
                        <BodyCell className="text-[13px]">{t.captains.join(", ") || <span className="text-muted">None yet</span>}</BodyCell>
                      </BodyRow>
                    );
                  })}
                </TableBody>
              </DataTable>
            </TableWrap>
          ) : (
            <EmptyState icon="users" title={`No teams in ${d.name} yet`}>
              {editable ? "Add the first team to start building the schedule." : null}
            </EmptyState>
          )}
          {d.rosterMin != null || d.rosterMax != null ? <p className="text-[13px] text-muted">Roster size: {rosterLimitLabel(d)}. Rosters outside that range are flagged.</p> : null}
        </section>
      ) : null}

      {tab === "schedule" ? (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[26px]">Schedule</h2>
            {editable && teams.length >= 2 ? (
              <ButtonLink href={withSeason(`/admin/matches/new?division=${d.code}`, season)} variant="primary" size="sm">
                <Icon name="plus" className="size-4" />
                Add match
              </ButtonLink>
            ) : null}
          </div>
          {matches.length ? (
            <TableWrap>
              <DataTable>
                <caption className="sr-only">{`${d.name} matches`}</caption>
                <TableHead>
                  <tr>
                    <HeadCell>Game</HeadCell>
                    <HeadCell>Date & time</HeadCell>
                    <HeadCell>Match</HeadCell>
                    <HeadCell>Field</HeadCell>
                    <HeadCell align="center">Score</HeadCell>
                    <HeadCell>Status</HeadCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {matches.map((m) => (
                    <BodyRow key={m.id}>
                      <BodyCell className="font-mono">
                        <RowLink href={withSeason(`/admin/matches/${m.gameNumber}`, season)}>#{m.gameNumber}</RowLink>
                      </BodyCell>
                      <BodyCell className="whitespace-nowrap">
                        {m.date}
                        <div className="text-xs text-muted">{m.time}</div>
                      </BodyCell>
                      <BodyCell className="whitespace-nowrap">
                        <b>{m.homeTeam.name}</b>
                        <div className="text-[13px] text-muted">vs {m.awayTeam.name}</div>
                      </BodyCell>
                      <BodyCell className="whitespace-nowrap">{m.field}</BodyCell>
                      <BodyCell align="center">
                        <b className="font-display text-xl font-extrabold whitespace-nowrap">{m.score ? m.score.join("–") : "—"}</b>
                      </BodyCell>
                      <BodyCell>
                        <MatchStatusBadge status={m.status} />
                      </BodyCell>
                    </BodyRow>
                  ))}
                </TableBody>
              </DataTable>
            </TableWrap>
          ) : (
            <EmptyState icon="cal" title={`No ${d.name} matches yet`}>
              {editable ? (teams.length >= 2 ? "Add a match to start the schedule." : "Add at least two teams first.") : null}
            </EmptyState>
          )}
        </section>
      ) : null}

      {tab === "standings" ? (
        completed ? (
          <div className="grid gap-[18px] xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <section className="flex min-w-0 flex-col gap-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-[26px]">Standings</h2>
                <span className="text-[13px] text-muted">
                  Based on {completed} completed match{completed === 1 ? "" : "es"}
                </span>
              </div>
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
        ) : (
          <EmptyState icon="list" title="No completed matches yet">
            Standings and top scorers appear once {d.name} has a confirmed result.
          </EmptyState>
        )
      ) : null}
    </>
  );
}
