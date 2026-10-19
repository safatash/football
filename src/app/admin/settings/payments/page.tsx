import type { PaymentMethod, PaymentStatus } from "@prisma/client";
import { PageHeading } from "@/components/league";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, StatCard } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { BodyCell, BodyRow, DataTable, HeadCell, RowLink, TableBody, TableHead, TableWrap } from "@/components/ui/table";
import { METHODS } from "@/lib/billing";
import { money } from "@/lib/format";
import { REPORT_STATUSES, seasonPayments } from "@/lib/queries/payments-report";
import { ParamFilter } from "../../_components/param-filter";
import { param, seasonFrom, withSeason, type SearchParams } from "../../_components/season";

export const metadata = { title: "Payments" };

const TONE: Record<string, "ok" | "warn" | "bad" | "info" | "neutral"> = { PAID: "ok", REFUNDED: "neutral", WAIVED: "info", UNPAID: "bad", FAILED: "bad" };

export default async function PaymentsReportPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const season = await seasonFrom(sp);
  const method = (METHODS.find(([k]) => k === param(sp.method))?.[0] ?? null) as PaymentMethod | null;
  const status = (REPORT_STATUSES.find(([k]) => k === param(sp.status))?.[0] ?? null) as PaymentStatus | null;
  const { rows, totals } = await seasonPayments(season.id, { method, status });
  const q = new URLSearchParams();
  if (method) q.set("method", method);
  if (status) q.set("status", status);
  if (!season.isActive) q.set("season", season.name);

  return (
    <>
      <PageHeading
        title="Payments"
        sub={`${season.name} · registrations and game passes`}
        actions={
          <ButtonLink href={`/admin/settings/payments/export${q.size ? `?${q}` : ""}`} variant="ghost" size="sm">
            <Icon name="dl" className="size-4" />
            Export CSV
          </ButtonLink>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <ParamFilter param="method" label="Method" allLabel="All methods" options={METHODS.map(([value, label]) => ({ value, label }))} value={method ?? ""} />
        <ParamFilter param="status" label="Status" allLabel="All statuses" options={REPORT_STATUSES.map(([value, label]) => ({ value, label }))} value={status ?? ""} />
      </div>
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatCard label="Collected" value={money(totals.collected)} note={`${rows.filter((r) => r.status === "PAID").length} payments`} />
        <StatCard label="Refunded" value={money(totals.refunded)} note={`${rows.filter((r) => r.status === "REFUNDED").length} refunds`} />
        <StatCard label="Net" value={money(totals.net)} note="Collected minus refunds" />
        <StatCard label="Waived" value={money(totals.waived)} note="No money moved" />
      </div>
      {rows.length ? (
        <TableWrap>
          <DataTable>
            <caption className="sr-only">{`${season.name} payments`}</caption>
            <TableHead>
              <tr>
                <HeadCell>Date</HeadCell>
                <HeadCell>Player</HeadCell>
                <HeadCell>For</HeadCell>
                <HeadCell>Status</HeadCell>
                <HeadCell align="right">Amount</HeadCell>
                <HeadCell>Method</HeadCell>
                <HeadCell>Reference</HeadCell>
                <HeadCell>Recorded by</HeadCell>
                <HeadCell>Notes</HeadCell>
              </tr>
            </TableHead>
            <TableBody>
              {rows.map((r) => (
                <BodyRow key={r.id}>
                  <BodyCell className="whitespace-nowrap">{r.date}</BodyCell>
                  <BodyCell className="whitespace-nowrap">
                    <RowLink href={withSeason(`/admin/players/${r.playerId}`, season)}>{r.player}</RowLink>
                  </BodyCell>
                  <BodyCell className="text-[13px] whitespace-nowrap">{r.for}</BodyCell>
                  <BodyCell>
                    <Badge tone={TONE[r.status] ?? "neutral"}>{REPORT_STATUSES.find(([k]) => k === r.status)?.[1] ?? r.status}</Badge>
                  </BodyCell>
                  <BodyCell align="right" className="font-bold whitespace-nowrap">
                    {r.net < 0 ? "−" : ""}
                    {money(r.amount)}
                  </BodyCell>
                  <BodyCell className="whitespace-nowrap">{r.method}</BodyCell>
                  <BodyCell className="text-[13px]">{r.reference || "—"}</BodyCell>
                  <BodyCell className="text-[13px]">{r.recordedBy || "—"}</BodyCell>
                  <BodyCell className="min-w-[160px] text-[13px] text-muted">{r.notes || "—"}</BodyCell>
                </BodyRow>
              ))}
            </TableBody>
          </DataTable>
        </TableWrap>
      ) : (
        <EmptyState icon="card" title="No payments match">
          {method || status ? "Try another method or status." : `Nothing recorded for ${season.name} yet.`}
        </EmptyState>
      )}
    </>
  );
}
