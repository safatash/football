import Link from "next/link";
import { PageHeading } from "@/components/league";
import { Badge } from "@/components/ui/badge";
import { STATUS_TONE } from "./status";
import { BodyCell, BodyRow, DataTable, HeadCell, TableBody, TableHead, TableWrap } from "@/components/ui/table";
import { fmtDateOnly } from "@/lib/format";
import { listOrganizations } from "@/platform/organizations";

export const metadata = { title: "Leagues" };
export const dynamic = "force-dynamic";

const ago = (d: Date | null) => {
  if (!d) return "—";
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  return days <= 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
};

export default async function PlatformHome() {
  const orgs = await listOrganizations();
  return (
    <>
      <PageHeading title="Leagues" sub={`${orgs.length} leagues · ${orgs.filter((o) => o.status === "TRIAL").length} on trial`} />
      <TableWrap>
        <DataTable>
          <TableHead>
            <tr>
              <HeadCell>League</HeadCell>
              <HeadCell>Status</HeadCell>
              <HeadCell>Plan</HeadCell>
              <HeadCell align="right">Players</HeadCell>
              <HeadCell>Created</HeadCell>
              <HeadCell>Last activity</HeadCell>
            </tr>
          </TableHead>
          <TableBody>
            {orgs.map((o) => (
              <BodyRow key={o.id}>
                <BodyCell>
                  <Link href={`/platform/orgs/${o.id}`} className="font-bold hover:underline">
                    {o.name}
                  </Link>
                  <span className="block text-[12.5px] text-muted">{o.customDomain ?? o.url.replace(/^https?:\/\//, "")}</span>
                </BodyCell>
                <BodyCell>
                  <Badge tone={STATUS_TONE[o.status]}>{o.status.replace("_", " ").toLowerCase()}</Badge>
                  {o.status === "TRIAL" && o.trialEndsAt ? <span className="block text-[12.5px] text-muted">until {fmtDateOnly(o.trialEndsAt)}</span> : null}
                </BodyCell>
                <BodyCell>{o.plan}</BodyCell>
                <BodyCell align="right">{o.players}</BodyCell>
                <BodyCell>{fmtDateOnly(o.createdAt)}</BodyCell>
                <BodyCell>{ago(o.lastActivity)}</BodyCell>
              </BodyRow>
            ))}
          </TableBody>
        </DataTable>
      </TableWrap>
    </>
  );
}
