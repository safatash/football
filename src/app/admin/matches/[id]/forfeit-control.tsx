"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, Notice } from "@/components/ui/card";
import { recordForfeit } from "@/lib/actions/schedule";

/** Match page: record that a team forfeited (the other wins by the league's forfeit score). */
export function ForfeitControl({ matchId, home, away, forfeitTeamId, goals, disabled }: { matchId: string; home: { id: string; name: string }; away: { id: string; name: string }; forfeitTeamId: string | null; goals: number; disabled: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const forfeited = forfeitTeamId ? (forfeitTeamId === home.id ? home : away) : null;
  const run = (team: { id: string; name: string }) => {
    if (!window.confirm(`Record a forfeit by ${team.name}? The other team wins ${goals}–0, and it counts in the standings.`)) return;
    start(async () => {
      setError("");
      const res = await recordForfeit({ matchId, forfeitTeamId: team.id });
      if (!res.ok) return setError(res.error);
      router.refresh();
    });
  };
  return (
    <Card className="order-last flex flex-col gap-3">
      <CardHeader title="Forfeit" className="mb-0" />
      {forfeited ? (
        <p className="text-sm">
          <b>{forfeited.name}</b> forfeited. Editing the match result replaces the forfeit.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted">If a team doesn’t show or can’t field enough players, record a forfeit: the other team wins {goals}–0.</p>
          {error ? <Notice tone="bad">{error}</Notice> : null}
          <div className="flex flex-wrap gap-2">
            {[home, away].map((t) => (
              <Button key={t.id} variant="ghost" size="sm" disabled={disabled || pending} onClick={() => run(t)}>
                {t.name} forfeited
              </Button>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
