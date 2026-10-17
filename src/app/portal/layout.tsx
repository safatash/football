import type { ReactNode } from "react";
import { AppFrame } from "@/components/shell/app-frame";
import { getActiveSeason } from "@/lib/queries/season";
import { requireUser } from "@/lib/session";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const session = await requireUser("/portal");
  const season = await getActiveSeason();
  return (
    <AppFrame name={session.user.name ?? session.user.email ?? "Player"} isCaptain={session.user.isCaptain} season={season?.name ?? ""}>
      {children}
    </AppFrame>
  );
}
