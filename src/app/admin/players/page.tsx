import { Avatar, PageHeading } from "@/components/league";
import { PaymentBadge, PlayerStatusBadge, RegistrationBadge, RoleTag } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BodyCell, BodyRow, DataTable, FilterChip, HeadCell, RowLink, TableBody, TableHead, TableWrap } from "@/components/ui/table";
import { listPlayers, registeredCount, type PlayerRow } from "@/lib/queries/players";
import { param, seasonFrom, withSeason, type SearchParams } from "../_components/season";

export const metadata = { title: "Players" };

const FILTERS: [key: string, label: string, test: (p: PlayerRow) => boolean][] = [
  ["all", "All", () => true],
  ["active", "Active", (p) => p.status === "Active"],
  ["pending", "Pending Approval", (p) => p.status === "Pending Approval"],
  ["suspended", "Suspended", (p) => p.status === "Suspended"],
];

export default async function PlayersPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const season = await seasonFrom(sp);
  const [players, registered] = await Promise.all([listPlayers(season.id, param(sp.q)), registeredCount(season.id)]);
  const filter = FILTERS.find(([k]) => k === param(sp.status)) ?? FILTERS[0];
  const q = param(sp.q).trim();
  const needle = q.toLowerCase();
  const rows = players.filter(filter[2]).filter((p) => !needle || `${p.name} ${p.email}`.toLowerCase().includes(needle));

  const href = (key: string) => {
    const p = new URLSearchParams();
    if (key !== "all") p.set("status", key);
    if (q) p.set("q", q);
    if (season.archived) p.set("season", season.name);
    return `/admin/players${p.size ? `?${p}` : ""}`;
  };

  return (
    <>
      <PageHeading
        title="Players"
        sub={`${rows.length} shown · ${registered} registered this season${q ? " · search covers every player" : ""}`}
        actions={
          season.archived ? null : (
            <ButtonLink href="/admin/players/new" variant="primary" size="sm">
              <Icon name="plus" className="size-4" />
              Add player
            </ButtonLink>
          )
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map(([key, label, test]) => (
          <FilterChip key={key} href={href(key)} active={filter[0] === key} count={players.filter(test).length}>
            {label}
          </FilterChip>
        ))}
        <form action="/admin/players" role="search" className="relative min-w-[180px] max-w-[320px] flex-1">
          {filter[0] !== "all" ? <input type="hidden" name="status" value={filter[0]} /> : null}
          {season.archived ? <input type="hidden" name="season" value={season.name} /> : null}
          <Icon name="search" className="absolute top-2.5 left-3.5 size-[18px] text-muted" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search players"
            aria-label="Search players by name or email"
            className="h-[38px] w-full rounded-full border-[1.5px] border-line-strong bg-surface pr-3.5 pl-10 text-sm outline-none focus:border-pitch-2"
          />
        </form>
      </div>

      {rows.length ? (
        <TableWrap>
          <DataTable>
            <TableHead>
              <tr>
                <HeadCell>Player</HeadCell>
                <HeadCell>Status</HeadCell>
                <HeadCell>Teams & access</HeadCell>
                <HeadCell>Registration</HeadCell>
                <HeadCell>Payment</HeadCell>
                <HeadCell align="right">Since</HeadCell>
              </tr>
            </TableHead>
            <TableBody>
              {rows.map((p) => (
                <BodyRow key={p.id}>
                  <BodyCell className="min-w-[220px]">
                    <span className="flex items-center gap-2.5">
                      <Avatar name={p.name} />
                      <span className="min-w-0">
                        <RowLink href={withSeason(`/admin/players/${p.id}`, season)}>{p.name}</RowLink>
                        <div className="truncate text-xs text-muted">{p.email}</div>
                      </span>
                    </span>
                  </BodyCell>
                  <BodyCell>
                    <PlayerStatusBadge status={p.status} />
                  </BodyCell>
                  <BodyCell>
                    {p.teams.length ? (
                      <div className="flex flex-col gap-1">
                        {p.teams.map((t) => (
                          <span key={t.id} className="flex items-center gap-1.5 whitespace-nowrap">
                            <span className="text-[13px]">{t.name}</span>
                            <RoleTag role={t.role} />
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[13px] whitespace-nowrap text-muted">{p.passGame != null ? `Game pass · #${p.passGame}` : "Not placed yet"}</span>
                    )}
                  </BodyCell>
                  <BodyCell>
                    <RegistrationBadge status={p.reg} />
                  </BodyCell>
                  <BodyCell>
                    <PaymentBadge status={p.pay} />
                  </BodyCell>
                  <BodyCell align="right" className="text-muted">
                    {p.since}
                  </BodyCell>
                </BodyRow>
              ))}
            </TableBody>
          </DataTable>
        </TableWrap>
      ) : (
        <EmptyState icon="users" title="No players found">
          {q ? `No players match “${q}”.` : "No players match this filter."}
        </EmptyState>
      )}
    </>
  );
}
