import { notFound } from "next/navigation";
import { PageHeading } from "@/components/league";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader, EmptyState, KeyValue, StatCard } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { BodyCell, BodyRow, DataTable, HeadCell, RowLink, TableBody, TableHead, TableWrap } from "@/components/ui/table";
import { money } from "@/lib/format";
import { STATUS_LABEL, type OfficialStatus } from "@/lib/officials";
import { certDate, getReferee, positionsLabel } from "@/lib/queries/referees";
import { DemoBadge } from "../../_components/demo";
import { DoneNotice } from "../../_components/done-notice";
import { Crumbs, param, seasonFrom, type SearchParams } from "../../_components/season";
import { PaidToggle } from "../forms";

export const metadata = { title: "Referee" };

type Line = NonNullable<Awaited<ReturnType<typeof getReferee>>>["upcoming"][number];

function Lines({ lines, caption, pay }: { lines: Line[]; caption: string; pay?: boolean }) {
  return (
    <TableWrap>
      <DataTable className="text-[14px]">
        <caption className="sr-only">{caption}</caption>
        <TableHead>
          <tr>
            <HeadCell>Date</HeadCell>
            <HeadCell>Game</HeadCell>
            <HeadCell>Match</HeadCell>
            <HeadCell>Where</HeadCell>
            <HeadCell>Role</HeadCell>
            <HeadCell>Status</HeadCell>
            {pay ? <HeadCell align="right">Fee</HeadCell> : null}
            {pay ? <HeadCell>Paid</HeadCell> : null}
          </tr>
        </TableHead>
        <TableBody>
          {lines.map((l) => (
            <BodyRow key={l.id}>
              <BodyCell className="whitespace-nowrap">
                {l.date}
                <div className="text-xs text-muted">{l.time}</div>
              </BodyCell>
              <BodyCell className="font-mono">
                <RowLink href={`/admin/matches/${l.gameNumber}${l.seasonActive ? "" : `?season=${encodeURIComponent(l.seasonName)}`}`}>#{l.gameNumber}</RowLink>
              </BodyCell>
              <BodyCell className="whitespace-nowrap">
                {l.match}
                <div className="text-xs text-muted">{l.division}</div>
              </BodyCell>
              <BodyCell className="text-[13px]">{l.where}</BodyCell>
              <BodyCell>{l.role}</BodyCell>
              <BodyCell>
                <Badge tone={l.status === "CONFIRMED" ? "ok" : l.status === "ASSIGNED" ? "info" : "bad"}>{STATUS_LABEL[l.status as OfficialStatus]}</Badge>
              </BodyCell>
              {pay ? <BodyCell align="right">{money(l.fee)}</BodyCell> : null}
              {pay ? (
                <BodyCell>
                  {l.status === "ASSIGNED" || l.status === "CONFIRMED" ? <PaidToggle ids={[l.id]} paid={l.paid} label={l.paid ? "Paid ✓" : "Unpaid"} /> : <span className="text-muted">—</span>}
                </BodyCell>
              ) : null}
            </BodyRow>
          ))}
        </TableBody>
      </DataTable>
    </TableWrap>
  );
}

export default async function RefereePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const season = await seasonFrom(sp);
  const data = await getReferee(id, season.id);
  if (!data) notFound();
  const { ref, cert, upcoming, past, totals } = data;
  return (
    <>
      <div className="flex flex-col gap-2">
        <Crumbs items={[["Referees", "/admin/referees"], [ref.name]]} />
        <PageHeading
          title={
            <span className="flex flex-wrap items-center gap-3">
              {ref.name}
              {ref.active ? null : <Badge>Inactive</Badge>}
              {ref.isDemo ? <DemoBadge /> : null}
            </span>
          }
          sub={positionsLabel(ref.positions)}
          actions={
            <ButtonLink href={`/admin/referees/${ref.id}/edit`} variant="primary" size="sm">
              <Icon name="edit" className="size-4" />
              Edit referee
            </ButtonLink>
          }
        />
      </div>
      <DoneNotice done={param(sp.done)} what={param(sp.what)} />

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatCard label={`Matches · ${season.name}`} value={totals.matches} note={`${totals.centers} as center`} />
        <StatCard label="Earned" value={money(totals.earned)} note="This season" />
        <StatCard label="Paid" value={money(totals.paid)} note="Marked paid" />
        <StatCard label="Owed" value={money(totals.owed)} note={totals.owed ? "Not yet paid" : "All paid"} />
      </div>

      <div className="grid gap-[18px] md:grid-cols-2">
        <Card>
          <CardHeader title="Contact" />
          <KeyValue
            items={[
              ["Email", ref.email ?? "—"],
              ["Phone", ref.phone ?? "—"],
              ["Notes", ref.notes ?? "—"],
            ]}
          />
        </Card>
        <Card>
          <CardHeader title="Certification" />
          <KeyValue
            items={[
              ["Level", ref.certLevel ?? "—"],
              [
                "Expires",
                <span key="e" className="flex items-center gap-2">
                  {certDate(ref.certExpires)}
                  {cert === "expired" ? <Badge tone="bad">Expired</Badge> : cert === "expiring" ? <Badge tone="warn">Within 30 days</Badge> : null}
                </span>,
              ],
            ]}
          />
        </Card>
      </div>

      <section className="flex flex-col gap-2.5">
        <h2 className="text-[26px]">Upcoming assignments</h2>
        {upcoming.length ? <Lines lines={upcoming} caption="Upcoming assignments" /> : <EmptyState icon="cal" title="Nothing assigned yet" />}
      </section>
      <section className="flex flex-col gap-2.5">
        <h2 className="text-[26px]">Past matches</h2>
        {past.length ? <Lines lines={past} caption="Past matches" pay /> : <EmptyState icon="whistle" title="No past matches" />}
      </section>
    </>
  );
}
