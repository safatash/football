import { notFound } from "next/navigation";
import { PageHeading } from "@/components/league";
import { Badge, PaymentBadge, RegistrationBadge } from "@/components/ui/badge";
import { Card, CardHeader, KeyValue, Notice } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { getRegistrationReview } from "@/lib/queries/registrations";
import { ArchivedNotice, Crumbs, seasonFrom, withSeason, type SearchParams } from "../../_components/season";
import { ApproveRegistrationForm } from "./approve-form";

export const metadata = { title: "Registration" };

export default async function RegistrationDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  const season = await seasonFrom(await searchParams);
  const v = await getRegistrationReview(id, season);
  if (!v) notFound();

  return (
    <>
      <div className="flex flex-col gap-2">
        <Crumbs items={[["Registrations", withSeason("/admin/registrations", season)], [v.name]]} />
        <PageHeading
          title={v.name}
          sub={
            <>
              <span className="font-mono text-[13px]">{v.number}</span> · submitted {v.submitted} · {v.email}
            </>
          }
          actions={
            <>
              <RegistrationBadge status={v.status} />
              <PaymentBadge status={v.payment} />
            </>
          }
        />
      </div>
      <ArchivedNotice season={season} />

      <div className="grid gap-[18px] lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-[18px]">
          <Card>
            <CardHeader title="Eligibility checks" />
            <ul className="flex flex-col gap-2.5">
              {v.checks.map(([ok, text], i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <Icon name={ok ? "check" : "alert"} className={`mt-0.5 size-[18px] shrink-0 ${ok ? "text-ok" : "text-warn"}`} />
                  <span className={`text-sm ${ok ? "" : "font-bold"}`}>{text}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Application" />
            <KeyValue items={v.application} />
          </Card>

          {v.captain ? (
            <Card className="border-pass">
              <CardHeader title="Captain request" action={<Badge tone="pass">Needs decision</Badge>} />
              {v.captain.note ? <p>“{v.captain.note}”</p> : <p>Asked for captain access on {v.captain.teams}.</p>}
              <p className="mt-2 text-[13px] text-muted">
                Current captain of {v.captain.teams}: {v.captain.captains}
              </p>
            </Card>
          ) : null}

          {v.denyNote ? (
            <Notice tone="bad" icon="x" title="Denied:">
              {v.denyNote}
            </Notice>
          ) : null}
        </div>

        <div className="min-w-0">
          <ApproveRegistrationForm mode="api" registration={v.decision} teams={v.teams} defaultTeamId={v.defaultTeamId} readOnly={season.archived} />
        </div>
      </div>
    </>
  );
}
