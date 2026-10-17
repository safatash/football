"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";

/** Placeholder blocks while a page loads. */
export function LoadingBlocks({ rows = 3, wide = false }: { rows?: number; wide?: boolean }) {
  return (
    <div className={`mx-auto flex w-full flex-col gap-4 px-4 py-5 ${wide ? "max-w-[1120px]" : "max-w-[640px]"}`} role="status" aria-label="Loading">
      <div className="h-9 w-2/3 animate-pulse rounded-lg bg-surface-3" />
      {Array.from({ length: rows }, (_, i) => (
        <Card key={i} className="flex flex-col gap-3">
          <div className="h-4 w-1/3 animate-pulse rounded bg-surface-3" />
          <div className="h-4 w-full animate-pulse rounded bg-surface-2" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-surface-2" />
        </Card>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/** Error boundary content: what happened, and a way to try again or go back. */
export function ErrorState({ error, retry, homeHref, homeLabel }: { error: Error & { digest?: string }; retry: () => void; homeHref: string; homeLabel: string }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto w-full max-w-[640px] px-4 py-8">
      <EmptyState
        icon="alert"
        title="Something went wrong"
        action={
          <div className="flex flex-wrap justify-center gap-2.5">
            <Button variant="primary" size="sm" onClick={retry}>
              Try again
            </Button>
            <ButtonLink href={homeHref} variant="ghost" size="sm">
              {homeLabel}
            </ButtonLink>
          </div>
        }
      >
        This page didn’t load. Try again, and if it keeps happening, email office@nvasa.org{error.digest ? ` with code ${error.digest}` : ""}.
      </EmptyState>
    </div>
  );
}
