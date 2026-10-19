import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/league";
import { Badge } from "@/components/ui/badge";
import { Card, KeyValue } from "@/components/ui/card";
import { fmtDateOnly, money } from "@/lib/format";
import { organizationDetail } from "@/platform/organizations";
import { STATUS_TONE } from "../../status";
import { OrgControls } from "../../controls";

export const metadata = { title: "League" };
export const dynamic = "force-dynamic";

export default async function PlatformOrgPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await organizationDetail(id);
  if (!d) notFound();
  const { org, usage } = d;
  return (
    <>
      <div className="flex flex-col gap-2">
        <Link href="/platform" className="text-sm font-bold text-muted hover:text-fg">
          ← Leagues
        </Link>
        <PageHeading
          title={org.name}
          sub={
            <a href={d.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
              {d.url.replace(/^https?:\/\//, "")}
            </a>
          }
          actions={<Badge tone={STATUS_TONE[org.status]}>{org.status.replace("_", " ").toLowerCase()}</Badge>}
        />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <h2 className="text-xl">Account</h2>
          <KeyValue
            items={[
              ["Plan", org.plan],
              ["Trial ends", org.trialEndsAt ? fmtDateOnly(org.trialEndsAt) : "—"],
              ["Created", fmtDateOnly(org.createdAt)],
              ["Contact", org.contactEmail ?? "—"],
              ["Custom domain", org.customDomain ?? "—"],
              ["Office", d.office.map((m) => `${m.email} (${m.role.toLowerCase()})`).join(", ") || "—"],
            ]}
          />
        </Card>
        <Card className="flex flex-col gap-3">
          <h2 className="text-xl">Usage</h2>
          <KeyValue
            items={[
              ["Players", String(usage.players)],
              ["Teams", String(usage.teams)],
              ["Seasons", String(usage.seasons)],
              ["Matches", String(usage.matches)],
              ["Registrations", String(usage.registrations)],
              ["Collected (paid)", money(usage.collected)],
            ]}
          />
        </Card>
      </div>
      <OrgControls id={org.id} status={org.status} plan={org.plan} />
      <Card className="flex flex-col gap-2">
        <h2 className="text-xl">Support access</h2>
        {d.impersonations.length ? (
          <ul className="flex flex-col gap-1 text-[13.5px]">
            {d.impersonations.map((i, n) => (
              <li key={n}>
                {i.user.email} · {i.startedAt.toISOString().slice(0, 16).replace("T", " ")} UTC ·{" "}
                {i.endedAt ? "stopped" : i.expiresAt < new Date() ? "expired" : <b>active</b>}
                {i.reason ? ` · ${i.reason}` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13.5px] text-muted">Nobody from the platform has acted as this league’s admin.</p>
        )}
      </Card>
    </>
  );
}
