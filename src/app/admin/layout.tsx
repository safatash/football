import { Suspense, type ReactNode } from "react";
import { AdminShell } from "@/components/shell/admin-shell";
import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { getActiveSeason, isSeasonClosed, listSeasons } from "@/lib/queries/season";
import { demoSummary } from "@/lib/demo";
import { AdminDemoNotice } from "./_components/demo";
import { ImpersonationBanner } from "./_components/impersonation-banner";
import { getBrand } from "@/lib/branding";

export const metadata = { title: "League office" };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await requireAdmin();
  const [seasons, active] = await Promise.all([listSeasons(), getActiveSeason()]);
  const seasonId = active?.id ?? "";
  const [pending, placement, demo] = await Promise.all([
    db.registration.count({ where: { seasonId, status: { in: ["SUBMITTED", "PENDING"] } } }),
    db.registration.count({ where: { seasonId, placementState: "NEW", status: { in: ["SUBMITTED", "PENDING", "APPROVED"] } } }),
    demoSummary(),
  ]);
  return (
    <Suspense>
      <AdminShell
        user={{ name: session.user.name ?? session.user.email ?? "League office", title: "League office" }}
        counts={{ registrations: pending, placement }}
        seasons={seasons.map((s) => s.name)}
        activeSeason={active?.name ?? ""}
        closedSeasons={seasons.filter((s) => isSeasonClosed(s)).map((s) => s.name)}
        divisionsHref="/admin/divisions"
      >
        {session.user.impersonating ? <ImpersonationBanner email={session.user.email ?? ""} league={(await getBrand()).name} /> : null}
        {session.user.orgRole === "STAFF" ? (
          <p role="note" className="rounded-xl border border-dashed border-line-strong bg-surface px-4 py-2.5 text-[13.5px] text-muted">
            <b className="text-fg">View only:</b> staff can see the league office. An owner or admin makes changes.
          </p>
        ) : null}
        <AdminDemoNotice summary={demo} />
        {children}
      </AdminShell>
    </Suspense>
  );
}
