import { PageHeading } from "@/components/league";
import { Notice } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { FilterChip } from "@/components/ui/table";
import { ACTIVE_SEASON } from "@/lib/league-data";
import { ArchivedNotice, param, seasonFrom, withSeason, type SearchParams } from "../_components/season";
import { loadDbRegistrations, type RegListRow } from "../_components/registration-data";
import { RegistrationTable } from "../_components/registration-table";

export const metadata = { title: "Registrations" };

const FILTERS: [key: string, label: string, test: (r: RegListRow) => boolean][] = [
  ["all", "All", () => true],
  ["review", "Needs review", (r) => r.open],
  ["captain", "Captain requests", (r) => r.captainRequest],
  ["new", "New players", (r) => r.isNew],
  ["approved", "Approved", (r) => r.status === "APPROVED"],
  ["denied", "Denied", (r) => r.status === "REJECTED"],
];

export default async function RegistrationsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const season = seasonFrom(sp);
  const filter = FILTERS.find(([k]) => k === param(sp.filter)) ?? FILTERS[0];
  const q = param(sp.q).trim();

  let all: RegListRow[] = [];
  let failed = false;
  try {
    all = await loadDbRegistrations({ seasonName: season });
  } catch (e) {
    console.error("Registrations query failed", e);
    failed = true;
  }

  const needle = q.toLowerCase();
  const rows = all.filter(filter[2]).filter((r) => !needle || `${r.name} ${r.email}`.toLowerCase().includes(needle));

  const href = (key: string) => {
    const p = new URLSearchParams();
    if (key !== "all") p.set("filter", key);
    if (q) p.set("q", q);
    if (season !== ACTIVE_SEASON) p.set("season", season);
    return `/admin/registrations${p.size ? `?${p}` : ""}`;
  };

  return (
    <>
      <PageHeading title="Registrations" sub={`${season} season registrations. Payment is tracked separately from approval.`} />
      <ArchivedNotice season={season} />
      {failed ? (
        <Notice tone="bad" title="Registrations didn’t load.">
          Refresh the page to try again.
        </Notice>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map(([key, label, test]) => (
          <FilterChip key={key} href={href(key)} active={filter[0] === key} count={all.filter(test).length}>
            {label}
          </FilterChip>
        ))}
        <form action="/admin/registrations" role="search" className="relative min-w-[180px] max-w-[320px] flex-1">
          {filter[0] !== "all" ? <input type="hidden" name="filter" value={filter[0]} /> : null}
          {season !== ACTIVE_SEASON ? <input type="hidden" name="season" value={season} /> : null}
          <Icon name="search" className="absolute top-2.5 left-3.5 size-[18px] text-muted" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Name or email"
            aria-label="Search registrations"
            className="h-[38px] w-full rounded-full border-[1.5px] border-line-strong bg-surface pr-3.5 pl-10 text-sm outline-none focus:border-pitch-2"
          />
        </form>
      </div>

      <RegistrationTable rows={rows} hrefFor={(id) => withSeason(`/admin/registrations/${id}`, season)} />
    </>
  );
}
