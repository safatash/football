import type { ReactNode } from "react";
import { AppFrame } from "@/components/shell/app-frame";
import { CaptainTabs } from "@/components/shell/app-nav";
import { TeamHeader } from "@/components/shell/layout";
import { requireUser } from "@/lib/session";
import { division, team } from "@/lib/league-data";

export const metadata = { title: "Captain · Fairfax United" };

// Captain tools run on Spring 2026 sample data (Fairfax United) until lineup,
// availability and match-report tables exist in the schema.
export default async function CaptainLayout({ children }: { children: ReactNode }) {
  const session = await requireUser("/captain");
  const t = team("ffx");
  return (
    <AppFrame name={session.user.name ?? "Player"} isCaptain>
      <TeamHeader teamId={t.id} name={t.name} sub={`${division(t.div).name} · Spring 2026`} role="Captain" />
      <CaptainTabs />
      {children}
    </AppFrame>
  );
}
