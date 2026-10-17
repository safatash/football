import type { ReactNode } from "react";
import { BottomTabs, TopNav } from "./app-nav";
import { ACTIVE_SEASON } from "@/lib/league-data";

/** Signed-in player/captain frame: desktop top nav, mobile bottom tabs. */
export function AppFrame({ children, name, isCaptain }: { children: ReactNode; name: string; isCaptain?: boolean }) {
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const teamHref = isCaptain ? "/captain" : "/portal/team";
  return (
    <div className="flex min-h-screen flex-col">
      <TopNav teamHref={teamHref} initials={initials} season={ACTIVE_SEASON} />
      <div className="flex flex-1 flex-col">{children}</div>
      <BottomTabs teamHref={teamHref} />
    </div>
  );
}
