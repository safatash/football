"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { Field, SelectInput, TextInput } from "@/components/ui/field";
import { addPointAdjustment, deletePointAdjustment } from "@/lib/actions/schedule";

export type AdjustmentRow = { id: string; teamName: string; divisionName: string; points: number; reason: string; date: string };

/** Admin › Standings: point deductions (and bonuses) with a reason, listed and removable. */
export function PointAdjustments({ seasonId, teams, rows, readOnly }: { seasonId: string; teams: { id: string; name: string; divisionName: string }[]; rows: AdjustmentRow[]; readOnly: boolean }) {
  const router = useRouter();
  const [teamId, setTeamId] = useState("");
  const [points, setPoints] = useState("-3");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>, after?: () => void) =>
    start(async () => {
      const res = await fn();
      setMsg(res.ok ? { tone: "ok", text: res.message ?? "Saved" } : { tone: "bad", text: res.error ?? "Something went wrong." });
      if (res.ok) {
        after?.();
        router.refresh();
      }
    });
  const sign = (n: number) => (n > 0 ? `+${n}` : String(n));

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-xl">Point adjustments</h2>
      <p className="text-sm text-muted">Deductions (or bonuses) change a team’s points in the table, with the reason shown under it. Wins, draws and goals stay as played.</p>
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      {rows.length ? (
        <ul className="flex flex-col text-sm">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line py-2 last:border-0">
              <b className={r.points < 0 ? "text-bad" : "text-ok"}>{sign(r.points)}</b>
              <span className="min-w-0 flex-1">
                <b>{r.teamName}</b> <span className="text-muted">({r.divisionName})</span>: {r.reason}
              </span>
              <span className="text-muted">{r.date}</span>
              {readOnly ? null : (
                <Button variant="ghost" size="sm" disabled={pending} onClick={() => window.confirm(`Remove ${sign(r.points)} for ${r.teamName}?`) && run(() => deletePointAdjustment({ id: r.id }))}>
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">None this season.</p>
      )}
      {readOnly ? null : (
        <div className="grid gap-3 border-t border-line pt-3 md:grid-cols-[1fr_100px_1.4fr_auto] md:items-end">
          <Field label="Team" htmlFor="adj-team">
            <SelectInput id="adj-team" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              <option value="">Choose a team</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.divisionName})
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Points" htmlFor="adj-points">
            <TextInput id="adj-points" type="number" min={-99} max={99} value={points} onChange={(e) => setPoints(e.target.value)} />
          </Field>
          <Field label="Reason" htmlFor="adj-reason">
            <TextInput id="adj-reason" placeholder="e.g. Ineligible player, Game #204" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <Button
            variant="primary"
            disabled={pending || !teamId || !Number(points) || reason.trim().length < 3}
            onClick={() => run(() => addPointAdjustment({ seasonId, teamId, points: Number(points), reason }), () => setReason(""))}
          >
            Add
          </Button>
        </div>
      )}
    </Card>
  );
}
