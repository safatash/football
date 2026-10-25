"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { openStripeDashboard, startPaymentsOnboarding } from "@/lib/actions/online-payments";

/** Connect / continue onboarding, and the Express dashboard once connected. */
export function ConnectButtons({ connectLabel, dashboard, disabled }: { connectLabel: string | null; dashboard: boolean; disabled: boolean }) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const go = (action: typeof startPaymentsOnboarding) =>
    start(async () => {
      setError("");
      const res = await action();
      if (res.ok && res.data?.url) window.location.assign(res.data.url);
      else if (!res.ok) setError(res.error);
    });
  return (
    <div className="flex flex-col gap-3">
      {error ? <Notice tone="bad">{error}</Notice> : null}
      <div className="flex flex-wrap gap-2">
        {connectLabel ? (
          <Button variant="primary" disabled={disabled || pending} onClick={() => go(startPaymentsOnboarding)}>
            {pending ? "Opening Stripe…" : connectLabel}
          </Button>
        ) : null}
        {dashboard ? (
          <Button variant="ghost" disabled={disabled || pending} onClick={() => go(openStripeDashboard)}>
            Open Stripe dashboard
          </Button>
        ) : null}
      </div>
    </div>
  );
}
