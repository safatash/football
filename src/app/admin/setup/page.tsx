import Link from "next/link";
import { PageHeading } from "@/components/league";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { db } from "@/lib/db";
import { setupSteps } from "@/lib/queries/setup";
import { getBrand } from "@/lib/branding";
import { fmtDateOnly } from "@/lib/format";
import { orgById } from "@/platform/orgs";

export const metadata = { title: "Set up your league" };

export default async function SetupPage() {
  const [steps, brand] = await Promise.all([setupSteps(), getBrand()]);
  const org = brand.orgId ? await orgById(brand.orgId) : null;
  const done = steps.filter((s) => s.done).length;
  return (
    <>
      <PageHeading
        title={`Set up ${brand.name}`}
        sub={`${done} of ${steps.length} done`}
        actions={org?.status === "TRIAL" ? <Badge tone="info">Free trial</Badge> : null}
      />
      <TrialNote />
      <Card className="flex max-w-[760px] flex-col divide-y divide-line p-0">
        {steps.map((s, i) => {
          const body = (
            <>
              <span className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold ${s.done ? "bg-ok-bg text-ok" : "bg-surface-2 text-muted"}`}>{s.done ? <Icon name="check" className="size-4" /> : i + 1}</span>
              <span className="min-w-0 flex-1">
                <b className="block">{s.title}</b>
                <span className="block text-[13.5px] text-muted">{s.sub}</span>
              </span>
              {s.href ? <Icon name="right" className="size-4 text-muted" /> : <Badge dot={false}>Coming soon</Badge>}
            </>
          );
          return s.href ? (
            <Link key={s.key} href={s.href} className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-2">
              {body}
            </Link>
          ) : (
            <div key={s.key} className="flex items-center gap-3 px-4 py-3.5">
              {body}
            </div>
          );
        })}
      </Card>
    </>
  );
}

async function TrialNote() {
  const brand = await getBrand();
  if (!brand.orgId) return null;
  const org = await db.organizationSettings.findFirst({ select: { organization: { select: { status: true, trialEndsAt: true } } } });
  const o = org?.organization;
  if (o?.status !== "TRIAL" || !o.trialEndsAt) return null;
  return <p className="text-[13.5px] text-muted">Your free trial runs until {fmtDateOnly(o.trialEndsAt)}.</p>;
}
