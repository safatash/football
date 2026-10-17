import { Suspense, type ReactNode } from "react";
import { AdminShell } from "@/components/shell/admin-shell";
import { requireAdmin } from "@/lib/session";
import prisma from "@/lib/prisma";
import { PLACEMENTS } from "@/lib/league-data";

export const metadata = { title: "League office" };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await requireAdmin();
  let pending = 0;
  try {
    pending = await prisma.registration.count({ where: { status: "PENDING" } });
  } catch {
    pending = 0;
  }
  return (
    <Suspense>
      <AdminShell
        user={{ name: session.user.name ?? session.user.email ?? "League office", title: "League office" }}
        counts={{ registrations: pending, placement: PLACEMENTS.filter((p) => p.state === "New").length }}
      >
        {children}
      </AdminShell>
    </Suspense>
  );
}
