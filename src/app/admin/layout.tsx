import { Suspense, type ReactNode } from "react";
import { AdminShell } from "@/components/shell/admin-shell";
import { requireAdmin } from "@/lib/session";
import prisma from "@/lib/prisma";
import { getActiveSeason, listSeasons } from "@/lib/queries/season";

export const metadata = { title: "League office" };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await requireAdmin();
  const [seasons, active] = await Promise.all([listSeasons(), getActiveSeason()]);
  const seasonId = active?.id ?? "";
  const [pending, placement, firstDivision] = await Promise.all([
    prisma.registration.count({ where: { seasonId, status: { in: ["SUBMITTED", "PENDING"] } } }),
    prisma.registration.count({ where: { seasonId, placementState: "NEW", status: { in: ["SUBMITTED", "PENDING", "APPROVED"] } } }),
    prisma.division.findFirst({ where: { seasonId }, orderBy: { displayOrder: "asc" }, select: { code: true } }),
  ]);
  return (
    <Suspense>
      <AdminShell
        user={{ name: session.user.name ?? session.user.email ?? "League office", title: "League office" }}
        counts={{ registrations: pending, placement }}
        seasons={seasons.map((s) => s.name)}
        activeSeason={active?.name ?? ""}
        divisionsHref={`/admin/divisions/${firstDivision?.code ?? ""}`}
      >
        {children}
      </AdminShell>
    </Suspense>
  );
}
