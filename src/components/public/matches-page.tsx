import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { FilterChip } from "@/components/ui/table";
import { divisionsOf, listPublicMatches, resolvePublicSeason } from "@/lib/queries/public";
import { listTeams } from "@/lib/queries/teams";
import { MatchList, PageTitle, PublicFrame, SeasonTabs } from "./index";

export type PublicSearchParams = Promise<Record<string, string | string[] | undefined>>;
export const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** /results and /schedule: season tabs, division chips, team filter and search (GET form). */
export async function MatchesPage({ kind, searchParams }: { kind: "results" | "schedule"; searchParams: PublicSearchParams }) {
  const sp = await searchParams;
  const { season, active, seasons } = await resolvePublicSeason(one(sp.season));
  if (!season) notFound();
  const division = one(sp.division);
  const team = one(sp.team);
  const q = one(sp.q).trim().slice(0, 60);
  const [divisions, teams, matches] = await Promise.all([
    divisionsOf(season.id),
    listTeams(season.id),
    listPublicMatches(season.id, kind, { divisionCode: division || undefined, teamId: team || undefined, q: q || undefined }),
  ]);
  const path = `/${kind}`;
  const href = (next: Record<string, string>) => {
    const p = new URLSearchParams();
    const merged = { season: season.id === active?.id ? "" : season.slug, division, team, q, ...next };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `${path}${p.size ? `?${p}` : ""}`;
  };
  const teamHref = (id: string) => `/teams/${id}`;
  const title = kind === "results" ? "Results" : "Schedule";

  return (
    <PublicFrame>
      <PageTitle eyebrow={season.name} title={title} sub={kind === "results" ? "Final scores, newest first." : "Upcoming games, soonest first."} />
      <SeasonTabs seasons={seasons} current={season} href={(slug) => href({ season: slug === active?.slug ? "" : slug, division: "", team: "" })} />
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip href={href({ division: "" })} active={!division}>
          All divisions
        </FilterChip>
        {divisions.map((d) => (
          <FilterChip key={d.id} href={href({ division: d.code, team: "" })} active={division === d.code}>
            {d.name}
          </FilterChip>
        ))}
      </div>
      <form action={path} method="get" role="search" className="flex flex-wrap items-center gap-2">
        {season.id !== active?.id ? <input type="hidden" name="season" value={season.slug} /> : null}
        {division ? <input type="hidden" name="division" value={division} /> : null}
        <label className="sr-only" htmlFor="filter-team">
          Team
        </label>
        <select id="filter-team" name="team" defaultValue={team} className="h-[38px] rounded-full border-[1.5px] border-line-strong bg-surface px-3.5 text-sm font-bold">
          <option value="">All teams</option>
          {teams
            .filter((t) => !division || t.division.code === division)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
        </select>
        <div className="relative min-w-[180px] max-w-[320px] flex-1">
          <Icon name="search" className="absolute top-2.5 left-3.5 size-[18px] text-muted" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Team, field or game #"
            aria-label={`Search ${title.toLowerCase()}`}
            className="h-[38px] w-full rounded-full border-[1.5px] border-line-strong bg-surface pr-3.5 pl-10 text-sm outline-none focus:border-pitch-2"
          />
        </div>
        <button type="submit" className="h-[38px] rounded-full bg-fg px-4 text-sm font-bold text-bg">
          Search
        </button>
      </form>
      <MatchList
        matches={matches}
        caption={`${season.name} ${title.toLowerCase()}`}
        teamHref={teamHref}
        matchHref={(m) => `/matches/${m.id}`}
        empty={
          <EmptyState icon={kind === "results" ? "trophy" : "cal"} title={kind === "results" ? "No results yet" : "No upcoming games"}>
            {q || team || division ? "Nothing matches these filters." : kind === "results" ? "Scores show up here once games are played." : "Check back when the next match day is scheduled."}
          </EmptyState>
        }
      />
    </PublicFrame>
  );
}
