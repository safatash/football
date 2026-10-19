"use client";

import { signOut } from "next-auth/react";
import { useTransition } from "react";
import { stopImpersonating } from "@/lib/actions/impersonation";

/** Always visible while the platform operator acts as this league's admin. */
export function ImpersonationBanner({ email, league }: { email: string; league: string }) {
  const [pending, start] = useTransition();
  function stop() {
    start(async () => {
      const r = await stopImpersonating();
      await signOut({ redirect: false });
      window.location.href = r.ok && r.data ? r.data.url : "/";
    });
  }
  return (
    <div role="alert" className="sticky top-0 z-50 flex flex-wrap items-center gap-3 rounded-xl border-2 border-bad bg-bad-bg px-4 py-2.5 text-[14px] text-bad">
      <b>Platform support:</b>
      <span className="flex-1">
        {email} is acting as an admin of {league}. Everything you do is recorded in {league}’s audit log.
      </span>
      <button type="button" onClick={stop} disabled={pending} className="rounded-full bg-bad px-3.5 py-1.5 text-[13px] font-bold text-white disabled:opacity-60">
        {pending ? "Stopping…" : "Stop impersonating"}
      </button>
    </div>
  );
}
