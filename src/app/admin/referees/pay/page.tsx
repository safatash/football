import { PageHeading } from "@/components/league";
import { ButtonLink } from "@/components/ui/button";
import { Card, EmptyState, StatCard } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { BodyCell, BodyRow, DataTable, HeadCell, RowLink, TableBody, TableHead, TableWrap } from "@/components/ui/table";
import { now } from "@/lib/clock";
import { money } from "@/lib/format";
import { addDays, fmtDateEastern, payReport } from "@/lib/queries/referees";
import { Crumbs, param, type SearchParams } from "../../_components/season";
import { PaidToggle } from "../forms";

export const metadata = { title: "Referee pay" };

const iso = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");

export default async function PayPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const today = fmtDateEastern(now());
  const to = iso(param(sp.to)) || today;
  const from = iso(param(sp.from)) || addDays(to, -27);
  const rows = await payReport(from, to);
  const owed = rows.reduce((a, r) => a + r.owed, 0);
  const paid = rows.reduce((a, r) => a + r.paid, 0);
  const matches = rows.reduce((a, r) => a + r.matches, 0);

  return (
    <>
      <div className="flex flex-col gap-2">
        <Crumbs items={[["Referees", "/admin/referees"], ["Pay"]]} />
        <PageHeading
          title="Referee pay"
          sub="Fees come from the match, else the division’s default for the role (Fees & eligibility)."
          actions={
            <ButtonLink href={`/admin/referees/pay/export?from=${from}&to=${to}`} variant="ghost" size="sm">
              <Icon name="dl" className="size-4" />
              Export CSV
            </ButtonLink>
          }
        />
      </div>
      <Card>
        <form className="flex flex-wrap items-end gap-3" action="/admin/referees/pay">
          <label className="flex flex-col gap-1 text-[13px] font-bold">
            From
            <input type="date" name="from" defaultValue={from} className="h-[38px] rounded-[var(--radius-field)] border-[1.5px] border-line-strong bg-surface px-3 font-normal" />
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-bold">
            To
            <input type="date" name="to" defaultValue={to} className="h-[38px] rounded-[var(--radius-field)] border-[1.5px] border-line-strong bg-surface px-3 font-normal" />
          </label>
          <button type="submit" className="h-[38px] rounded-full bg-pitch px-4 text-sm font-bold text-white">
            Show
          </button>
        </form>
      </Card>
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatCard label="Referees" value={rows.length} note={`${matches} assignments`} />
        <StatCard label="Owed" value={money(owed)} note="Not yet paid" />
        <StatCard label="Paid" value={money(paid)} note="Marked paid" />
        <StatCard label="Total" value={money(owed + paid)} note={`${from} to ${to}`} />
      </div>
      {rows.length ? (
        <TableWrap>
          <DataTable>
            <caption className="sr-only">Referee pay</caption>
            <TableHead>
              <tr>
                <HeadCell>Referee</HeadCell>
                <HeadCell align="right">Matches</HeadCell>
                <HeadCell align="right">Owed</HeadCell>
                <HeadCell align="right">Paid</HeadCell>
                <HeadCell>Mark</HeadCell>
              </tr>
            </TableHead>
            <TableBody>
              {rows.map((r) => {
                const unpaid = r.lines.filter((l) => !l.paid).map((l) => l.id);
                const done = r.lines.filter((l) => l.paid).map((l) => l.id);
                return (
                  <BodyRow key={r.id}>
                    <BodyCell className="whitespace-nowrap">
                      <RowLink href={`/admin/referees/${r.id}`}>{r.name}</RowLink>
                      <div className="text-xs text-muted">{r.lines.map((l) => `#${l.gameNumber} ${l.role}`).join(" · ")}</div>
                    </BodyCell>
                    <BodyCell align="right">{r.matches}</BodyCell>
                    <BodyCell align="right" className="font-bold">
                      {money(r.owed)}
                    </BodyCell>
                    <BodyCell align="right">{money(r.paid)}</BodyCell>
                    <BodyCell className="whitespace-nowrap">
                      {unpaid.length ? <PaidToggle ids={unpaid} paid={false} label={`Mark ${money(r.owed)} paid`} /> : <PaidToggle ids={done} paid label="Mark unpaid" />}
                    </BodyCell>
                  </BodyRow>
                );
              })}
            </TableBody>
          </DataTable>
        </TableWrap>
      ) : (
        <EmptyState icon="whistle" title="No assignments in these dates" />
      )}
    </>
  );
}
