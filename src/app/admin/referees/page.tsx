import Link from "next/link";
import { PageHeading } from "@/components/league";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { BodyCell, BodyRow, DataTable, HeadCell, RowLink, TableBody, TableHead, TableWrap } from "@/components/ui/table";
import { certDate, listReferees, positionsLabel } from "@/lib/queries/referees";
import { DemoBadge } from "../_components/demo";
import { DoneNotice } from "../_components/done-notice";
import { param, seasonFrom, type SearchParams } from "../_components/season";

export const metadata = { title: "Referees" };

export default async function RefereesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const season = await seasonFrom(sp);
  const refs = await listReferees(season.id);
  const flagged = refs.filter((r) => r.active && r.cert).length;
  return (
    <>
      <PageHeading
        title="Referees"
        sub={`${refs.filter((r) => r.active).length} active · matches counted for ${season.name}`}
        actions={
          <>
            <ButtonLink href="/admin/referees/assignments" variant="ghost" size="sm">
              <Icon name="cal" className="size-4" />
              Assignments
            </ButtonLink>
            <ButtonLink href="/admin/referees/pay" variant="ghost" size="sm">
              <Icon name="card" className="size-4" />
              Pay
            </ButtonLink>
            <ButtonLink href="/admin/referees/new" variant="primary" size="sm">
              <Icon name="plus" className="size-4" />
              New referee
            </ButtonLink>
          </>
        }
      />
      <DoneNotice done={param(sp.done)} what={param(sp.what)} />
      {flagged ? <p className="text-[13.5px] font-semibold text-warn">{flagged} active referee{flagged === 1 ? "’s" : "s’"} certification has expired or expires within 30 days.</p> : null}
      {refs.length ? (
        <TableWrap>
          <DataTable>
            <caption className="sr-only">Referees</caption>
            <TableHead>
              <tr>
                <HeadCell>Referee</HeadCell>
                <HeadCell>Contact</HeadCell>
                <HeadCell>Certification</HeadCell>
                <HeadCell>Expires</HeadCell>
                <HeadCell>Positions</HeadCell>
                <HeadCell>Status</HeadCell>
                <HeadCell align="right">Matches</HeadCell>
                <HeadCell align="right">
                  <span className="sr-only">Edit</span>
                </HeadCell>
              </tr>
            </TableHead>
            <TableBody>
              {refs.map((r) => (
                <BodyRow key={r.id} highlight={!!r.cert && r.active}>
                  <BodyCell className="whitespace-nowrap">
                    <span className="flex items-center gap-2">
                      <RowLink href={`/admin/referees/${r.id}`}>{r.name}</RowLink>
                      {r.isDemo ? <DemoBadge /> : null}
                    </span>
                  </BodyCell>
                  <BodyCell className="text-[13px]">
                    {r.email ?? <span className="text-muted">No email</span>}
                    {r.phone ? <div className="text-muted">{r.phone}</div> : null}
                  </BodyCell>
                  <BodyCell className="text-[13px]">{r.certLevel ?? "—"}</BodyCell>
                  <BodyCell className="whitespace-nowrap">
                    {certDate(r.certExpires)}
                    {r.cert === "expired" ? (
                      <Badge tone="bad" className="ml-2">
                        Expired
                      </Badge>
                    ) : r.cert === "expiring" ? (
                      <Badge tone="warn" className="ml-2">
                        Within 30 days
                      </Badge>
                    ) : null}
                  </BodyCell>
                  <BodyCell className="text-[13px] whitespace-nowrap">{positionsLabel(r.positions)}</BodyCell>
                  <BodyCell>{r.active ? <Badge tone="ok">Active</Badge> : <Badge>Inactive</Badge>}</BodyCell>
                  <BodyCell align="right">{r.season}</BodyCell>
                  <BodyCell align="right" className="relative z-[1]">
                    <Link href={`/admin/referees/${r.id}/edit`} className="text-[13.5px] font-bold text-pitch-2 underline underline-offset-4 dark:text-lime">
                      Edit
                    </Link>
                  </BodyCell>
                </BodyRow>
              ))}
            </TableBody>
          </DataTable>
        </TableWrap>
      ) : (
        <EmptyState
          icon="whistle"
          title="No referees yet"
          action={
            <ButtonLink href="/admin/referees/new" variant="primary" size="sm">
              New referee
            </ButtonLink>
          }
        >
          Add referees so they can be assigned to matches.
        </EmptyState>
      )}
    </>
  );
}
