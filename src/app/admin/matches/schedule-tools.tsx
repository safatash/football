"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { CheckRow } from "@/components/ui/controls";
import { Field, TextArea, TextInput } from "@/components/ui/field";
import { createSchedule, importSchedule, previewImport, previewSchedule, type ImportPreview, type SchedulePlan } from "@/lib/actions/schedule";

const fmtDay = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const fmtTime = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
};

type Division = { id: string; name: string; teams: number };

/** Admin › Matches › Generate: pick divisions and dates, preview the round robin, then create it. */
export function GenerateSchedule({ seasonId, divisions, defaults, fieldsWithTimes }: { seasonId: string; divisions: Division[]; defaults: { start: string; end: string }; fieldsWithTimes: number }) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>(divisions.filter((d) => d.teams >= 2).map((d) => d.id));
  const [start, setStart] = useState(defaults.start);
  const [end, setEnd] = useState(defaults.end);
  const [double, setDouble] = useState(false);
  const [skip, setSkip] = useState("");
  const [plan, setPlan] = useState<SchedulePlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start_] = useTransition();
  const input = () => ({ seasonId, divisionIds: picked, startDate: start, endDate: end, double, skipDates: skip.split(/[\s,]+/).filter(Boolean) });
  const toggle = (id: string) => {
    setPlan(null);
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };

  const preview = () =>
    start_(async () => {
      setError(null);
      const res = await previewSchedule(input());
      if (!res.ok) {
        setPlan(null);
        return setError(res.errors?.join(" ") || res.error);
      }
      setPlan(res.data!);
    });
  const create = () =>
    start_(async () => {
      const res = await createSchedule(input());
      if (!res.ok) return setError(res.error);
      router.push(`/admin/matches?done=added&what=${encodeURIComponent(`Created ${res.data!.created} matches`)}`);
    });

  const byDate = new Map<string, SchedulePlan["matches"]>();
  for (const m of plan?.matches ?? []) byDate.set(m.date, [...(byDate.get(m.date) ?? []), m]);

  return (
    <div className="flex max-w-[960px] flex-col gap-4">
      {fieldsWithTimes === 0 ? (
        <Notice tone="warn" title="No field times yet.">
          Add weekly times to your fields first (Settings › Fields › a field › Availability). The generator only uses those slots.
        </Notice>
      ) : null}
      <Card className="flex flex-col gap-4">
        <Field label="Divisions">
          <div className="grid gap-1 sm:grid-cols-2">
            {divisions.map((d) => (
              <CheckRow key={d.id} checked={picked.includes(d.id)} onChange={() => toggle(d.id)} title={d.name} sub={`${d.teams} team${d.teams === 1 ? "" : "s"}`} />
            ))}
          </div>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First match day" htmlFor="g-start">
            <TextInput id="g-start" type="date" value={start} onChange={(e) => (setPlan(null), setStart(e.target.value))} />
          </Field>
          <Field label="Last match day" htmlFor="g-end">
            <TextInput id="g-end" type="date" value={end} onChange={(e) => (setPlan(null), setEnd(e.target.value))} />
          </Field>
        </div>
        <Field label="Skip these dates" htmlFor="g-skip" hint="Holidays and other days without matches, e.g. 2026-09-07 2026-10-12">
          <TextInput id="g-skip" value={skip} onChange={(e) => (setPlan(null), setSkip(e.target.value))} />
        </Field>
        <CheckRow checked={double} onChange={(v) => (setPlan(null), setDouble(v))} title="Double round robin" sub="Every team plays every other team twice, once at home" />
        {error ? <Notice tone="bad">{error}</Notice> : null}
        <div className="flex gap-2">
          <Button variant="primary" onClick={preview} disabled={pending || !picked.length}>
            {pending && !plan ? "Planning…" : "Preview schedule"}
          </Button>
          {plan?.matches.length ? (
            <Button variant="accent" onClick={create} disabled={pending}>
              Create {plan.matches.length} matches
            </Button>
          ) : null}
        </div>
      </Card>

      {plan ? (
        <Card className="flex flex-col gap-4">
          <h2 className="text-xl">
            {plan.matches.length} match{plan.matches.length === 1 ? "" : "es"} on {byDate.size} day{byDate.size === 1 ? "" : "s"}
          </h2>
          {plan.notes.map((n) => (
            <Notice key={n} tone="info">
              {n}
            </Notice>
          ))}
          {plan.unscheduled.length ? (
            <Notice tone="warn" title={`${plan.unscheduled.length} pairing${plan.unscheduled.length === 1 ? "" : "s"} didn’t fit`}>
              Add more dates or field times, or schedule these by hand: {plan.unscheduled.map((u) => `${u.homeName} vs ${u.awayName} (${u.divisionName})`).join("; ")}.
            </Notice>
          ) : null}
          {[...byDate].map(([date, matches]) => (
            <section key={date} className="flex flex-col gap-1">
              <h3 className="font-bold">{fmtDay(date)}</h3>
              <ul className="flex flex-col text-sm">
                {matches.map((m) => (
                  <li key={`${m.fieldId}${m.time}`} className="flex flex-wrap gap-x-3 border-b border-line py-1.5 last:border-0">
                    <span className="w-[70px] text-muted">{fmtTime(m.time)}</span>
                    <span className="min-w-0 flex-1">
                      <b>{m.homeName}</b> vs <b>{m.awayName}</b>
                    </span>
                    <span className="text-muted">
                      {m.fieldName} · {m.divisionName} · round {m.round}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </Card>
      ) : null}
    </div>
  );
}

const EXAMPLE = `date,time,home,away,field,division
2026-09-06,9:00 am,Fairfax United,Bloodline,Wakefield Park 3,Women Premier`;

/** Admin › Matches › Import: paste a CSV, check every line, then import. */
export function ImportSchedule({ seasonId }: { seasonId: string }) {
  const router = useRouter();
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const check = () =>
    start(async () => {
      setError(null);
      const res = await previewImport({ seasonId, csv });
      if (!res.ok) return setError(res.error);
      setPreview(res.data!);
    });
  const run = () =>
    start(async () => {
      const res = await importSchedule({ seasonId, csv });
      if (!res.ok) return setError([res.error, ...(res.errors ?? [])].join(" "));
      router.push(`/admin/matches?done=added&what=${encodeURIComponent(`Imported ${res.data!.created} matches`)}`);
    });
  const readFile = async (file: File | undefined) => {
    if (!file) return;
    setPreview(null);
    setCsv(await file.text());
  };

  return (
    <div className="flex max-w-[960px] flex-col gap-4">
      <Card className="flex flex-col gap-4">
        <p className="text-sm text-muted">
          One match per line, with a header row. Required: <b>date</b>, <b>time</b>, <b>home</b>, <b>away</b>. Optional: <b>field</b> (“Park Field”), <b>division</b>, <b>game</b> (number).
          Teams by name or code. Dates like 2026-09-06 or 9/6/2026; times like 18:30 or 6:30 pm.
        </p>
        <Field label="CSV file" htmlFor="i-file">
          <input id="i-file" type="file" accept=".csv,text/csv" className="text-sm" onChange={(e) => readFile(e.target.files?.[0])} />
        </Field>
        <Field label="Or paste it here" htmlFor="i-csv">
          <TextArea id="i-csv" className="min-h-[180px] font-mono text-[13px]" placeholder={EXAMPLE} value={csv} onChange={(e) => (setPreview(null), setCsv(e.target.value))} />
        </Field>
        {error ? <Notice tone="bad">{error}</Notice> : null}
        <div className="flex gap-2">
          <Button variant="primary" onClick={check} disabled={pending || !csv.trim()}>
            Check file
          </Button>
          {preview && !preview.errors.length && preview.rows.length ? (
            <Button variant="accent" onClick={run} disabled={pending}>
              Import {preview.rows.length} matches
            </Button>
          ) : null}
        </div>
      </Card>

      {preview ? (
        <Card className="flex flex-col gap-3">
          <h2 className="text-xl">
            {preview.rows.length} ready{preview.errors.length ? ` · ${preview.errors.length} to fix` : ""}
            {preview.warnings.length ? ` · ${preview.warnings.length} warning${preview.warnings.length === 1 ? "" : "s"}` : ""}
          </h2>
          {preview.errors.length ? (
            <Notice tone="bad" title="Fix these lines, then check again. Nothing is imported until every line is valid.">
              <ul className="list-disc pl-5">
                {preview.errors.map((e) => (
                  <li key={e.line}>
                    Line {e.line}: {e.message}
                  </li>
                ))}
              </ul>
            </Notice>
          ) : null}
          {preview.warnings.length ? (
            <Notice tone="warn" title="Schedule clashes (you can still import)">
              <ul className="list-disc pl-5">
                {preview.warnings.map((w, i) => (
                  <li key={i}>
                    Line {w.line}: {w.message}
                  </li>
                ))}
              </ul>
            </Notice>
          ) : null}
          <ul className="flex flex-col text-sm">
            {preview.rows.map((r) => (
              <li key={r.line} className="flex flex-wrap gap-x-3 border-b border-line py-1.5 last:border-0">
                <span className="w-[160px] text-muted">
                  {fmtDay(r.date)}, {fmtTime(r.time)}
                </span>
                <span className="min-w-0 flex-1">
                  {r.gameNumber ? `#${r.gameNumber} · ` : ""}
                  <b>{r.home}</b> vs <b>{r.away}</b>
                </span>
                <span className="text-muted">
                  {r.field ?? "No field"} · {r.division}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
