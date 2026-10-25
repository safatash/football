"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { Field, SelectInput, TextInput } from "@/components/ui/field";
import { setFieldAvailability } from "@/lib/actions/schedule";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export type WindowRow = { weekday: number; start: string; end: string };

/** Field page: the weekly times this field can host matches (used by the schedule generator). */
export function AvailabilityForm({ fieldId, initial, readOnly }: { fieldId: string; initial: WindowRow[]; readOnly: boolean }) {
  const router = useRouter();
  const [rows, setRows] = useState<WindowRow[]>(initial);
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (i: number, patch: Partial<WindowRow>) => setRows((r) => r.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const save = () =>
    start(async () => {
      const res = await setFieldAvailability({ fieldId, windows: rows });
      setMsg(res.ok ? { tone: "ok", text: res.message } : { tone: "bad", text: res.error });
      if (res.ok) router.refresh();
    });
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-xl">Availability</h2>
      <p className="text-sm text-muted">The weekly times this field can host matches. The schedule generator only books matches inside them, two hours apart.</p>
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[1.3fr_1fr_1fr_auto] items-end gap-2">
          <Field label={i === 0 ? "Day" : ""} htmlFor={`av-day-${i}`}>
            <SelectInput id={`av-day-${i}`} value={r.weekday} disabled={readOnly} onChange={(e) => set(i, { weekday: Number(e.target.value) })}>
              {DAYS.map((d, k) => (
                <option key={d} value={k}>
                  {d}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label={i === 0 ? "From" : ""} htmlFor={`av-start-${i}`}>
            <TextInput id={`av-start-${i}`} type="time" value={r.start} disabled={readOnly} onChange={(e) => set(i, { start: e.target.value })} />
          </Field>
          <Field label={i === 0 ? "Until" : ""} htmlFor={`av-end-${i}`}>
            <TextInput id={`av-end-${i}`} type="time" value={r.end} disabled={readOnly} onChange={(e) => set(i, { end: e.target.value })} />
          </Field>
          {readOnly ? null : (
            <Button variant="ghost" size="sm" className="mb-1" onClick={() => setRows((x) => x.filter((_, k) => k !== i))}>
              Remove
            </Button>
          )}
        </div>
      ))}
      {!rows.length ? <p className="text-sm text-muted">No times yet.</p> : null}
      {readOnly ? null : (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setRows((x) => [...x, { weekday: 0, start: "09:00", end: "17:00" }])}>
            Add a time
          </Button>
          <Button variant="primary" size="sm" disabled={pending} onClick={save}>
            Save availability
          </Button>
        </div>
      )}
    </Card>
  );
}
