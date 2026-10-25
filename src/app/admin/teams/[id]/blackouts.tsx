"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { Field, TextInput } from "@/components/ui/field";
import { addTeamBlackout, removeTeamBlackout } from "@/lib/actions/schedule";

export type BlackoutRow = { id: string; date: string; label: string; note: string | null };

/** Team page: dates the team can't play. The schedule generator never books them. */
export function TeamBlackouts({ teamId, rows, readOnly }: { teamId: string; rows: BlackoutRow[]; readOnly: boolean }) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      setError("");
      const res = await fn();
      if (!res.ok) return setError(res.error ?? "Something went wrong.");
      after?.();
      router.refresh();
    });
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-xl">Blackout dates</h2>
      <p className="text-sm text-muted">Days this team can’t play. Generated schedules leave them free.</p>
      {error ? <Notice tone="bad">{error}</Notice> : null}
      {rows.length ? (
        <ul className="flex flex-col text-sm">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 border-b border-line py-1.5 last:border-0">
              <b>{r.label}</b>
              <span className="min-w-0 flex-1 text-muted">{r.note}</span>
              {readOnly ? null : (
                <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => removeTeamBlackout({ id: r.id }))}>
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">None.</p>
      )}
      {readOnly ? null : (
        <div className="grid gap-2 sm:grid-cols-[160px_1fr_auto] sm:items-end">
          <Field label="Date" htmlFor="bo-date">
            <TextInput id="bo-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Note (optional)" htmlFor="bo-note">
            <TextInput id="bo-note" placeholder="e.g. Team tournament" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <Button variant="primary" disabled={pending || !date} onClick={() => run(() => addTeamBlackout({ teamId, date, note }), () => (setDate(""), setNote("")))}>
            Add
          </Button>
        </div>
      )}
    </Card>
  );
}
