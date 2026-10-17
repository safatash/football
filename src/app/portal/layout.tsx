import type { ReactNode } from "react";
import { AppFrame } from "@/components/shell/app-frame";
import { requireUser } from "@/lib/session";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const session = await requireUser("/portal");
  return (
    <AppFrame name={session.user.name ?? session.user.email ?? "Player"} isCaptain={session.user.isCaptain}>
      {children}
    </AppFrame>
  );
}
