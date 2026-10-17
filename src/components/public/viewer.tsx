"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";

type Viewer = { signedIn: boolean; isAdmin: boolean; roles: Record<string, "captain" | "player">; suspended: string[] };
const ViewerContext = createContext<Viewer | null>(null);

/** Loads what the signed-in viewer may see for these teams. Renders nothing extra while signed out. */
export function ViewerProvider({ teamIds, children }: { teamIds: string[]; children: ReactNode }) {
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const key = teamIds.join(",");
  useEffect(() => {
    let live = true;
    fetch(`/api/public/viewer?teams=${encodeURIComponent(key)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((v: Viewer | null) => live && setViewer(v))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [key]);
  return <ViewerContext.Provider value={viewer}>{children}</ViewerContext.Provider>;
}

const useViewer = () => useContext(ViewerContext);

/** "Suspended" badge, shown to signed-in viewers only. */
export function SuspendedBadge({ playerId }: { playerId: string }) {
  const v = useViewer();
  if (!v?.signedIn || !v.suspended.includes(playerId)) return null;
  return <Badge tone="bad">Suspended</Badge>;
}

/** Print (team members, admins) and Manage (that team's captains, admins) for one game. */
export function MemberMatchLinks({ teamId, gameNumber, upcoming }: { teamId: string; gameNumber: number; upcoming: boolean }) {
  const v = useViewer();
  if (!v?.signedIn) return null;
  const role = v.roles[teamId];
  if (!role && !v.isAdmin) return null;
  return (
    <span className="inline-flex items-center gap-3 text-[13px] font-bold">
      <Link href={`/matches/${gameNumber}/print`} className="inline-flex items-center gap-1 text-pitch-2 underline underline-offset-4 dark:text-lime">
        <Icon name="print" className="size-3.5" />
        Print
      </Link>
      {upcoming && (role === "captain" || v.isAdmin) ? (
        <Link href={`/captain/${teamId}/matches/${gameNumber}/roster`} className="text-pitch-2 underline underline-offset-4 dark:text-lime">
          Manage
        </Link>
      ) : null}
    </span>
  );
}

/** "Edit report" for a captain of either team (or an admin). */
export function EditReportLink({ teamIds, gameNumber }: { teamIds: string[]; gameNumber: number }) {
  const v = useViewer();
  if (!v?.signedIn) return null;
  const team = teamIds.find((t) => v.roles[t] === "captain") ?? (v.isAdmin ? teamIds[0] : null);
  if (!team) return null;
  return (
    <Link href={`/captain/${team}/matches/${gameNumber}/report`} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line-strong px-3.5 text-[13.5px] font-bold hover:bg-surface-2">
      <Icon name="edit" className="size-4" />
      Edit report
    </Link>
  );
}
