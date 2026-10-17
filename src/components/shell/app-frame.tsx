import type { ReactNode } from "react";
import { BottomTabs, TopNav } from "./app-nav";

/** Signed-in player/captain frame: desktop top nav, mobile bottom tabs. */
export function AppFrame({ children, name, isCaptain, season }: { children: ReactNode; name: string; isCaptain?: boolean; season: string }) {
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const teamHref = isCaptain ? "/captain" : "/portal/team";
  return (
    <div className="flex min-h-screen flex-col">
      <TopNav teamHref={teamHref} initials={initials} season={season} />
      <div className="flex flex-1 flex-col">{children}</div>
      <BottomTabs teamHref={teamHref} />
    </div>
  );
}
