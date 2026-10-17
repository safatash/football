import { Badge, PaymentBadge, RegistrationBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/card";
import { BodyCell, BodyRow, DataTable, HeadCell, RowLink, TableBody, TableHead, TableWrap } from "@/components/ui/table";
import { money } from "@/lib/format";
import type { RegListRow } from "@/lib/queries/registrations";

export function RegistrationTable({ rows, showAmount = true, hrefFor }: { rows: RegListRow[]; showAmount?: boolean; hrefFor: (id: string) => string }) {
  if (!rows.length) {
    return (
      <EmptyState icon="check" title="Nothing here">
        No registrations match this filter.
      </EmptyState>
    );
  }
  return (
    <TableWrap>
      <DataTable>
        <TableHead>
          <tr>
            <HeadCell>Player</HeadCell>
            <HeadCell>Division</HeadCell>
            <HeadCell>Preferred team</HeadCell>
            <HeadCell>Registration</HeadCell>
            <HeadCell>Payment</HeadCell>
            <HeadCell>Submitted</HeadCell>
            {showAmount ? <HeadCell align="right">Amount</HeadCell> : null}
          </tr>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <BodyRow key={r.id}>
              <BodyCell className="min-w-[180px]">
                <RowLink href={hrefFor(r.id)}>{r.name}</RowLink>
                <div className="truncate text-xs text-muted">{r.email}</div>
                {r.captainRequest || r.needsPlacement ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {r.captainRequest ? (
                      <Badge tone="pass" dot={false}>
                        Captain request
                      </Badge>
                    ) : null}
                    {r.needsPlacement ? (
                      <Badge tone="info" dot={false}>
                        Needs placement
                      </Badge>
                    ) : null}
                  </div>
                ) : null}
              </BodyCell>
              <BodyCell className="whitespace-nowrap">{r.division}</BodyCell>
              <BodyCell className="whitespace-nowrap">{r.preferred}</BodyCell>
              <BodyCell>
                <RegistrationBadge status={r.status} />
              </BodyCell>
              <BodyCell>
                <PaymentBadge status={r.payment} />
              </BodyCell>
              <BodyCell className="whitespace-nowrap text-muted">{r.submitted}</BodyCell>
              {showAmount ? (
                <BodyCell align="right" className="font-semibold">
                  {money(r.amount)}
                </BodyCell>
              ) : null}
            </BodyRow>
          ))}
        </TableBody>
      </DataTable>
    </TableWrap>
  );
}
