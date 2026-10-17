"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { Dialog, Toast, useToast } from "@/components/ui/controls";
import { Field, TextArea } from "@/components/ui/field";
import { Crest, Jersey } from "@/components/league";
import { ActionBar, Screen } from "@/components/shell/layout";
import { firstLast, jerseyLabel } from "../../../roster-helpers";

type Stat = { g: number; a: number };
type CardColor = "y" | "r";
/** Stats and cards are keyed by player id. */
export type ReportDraft = {
  home: number;
  away: number;
  stats: Record<string, Stat>;
  cards: Record<string, CardColor | null>;
  redNote: string;
};
type Side = { id: string; name: string; color?: string | null; shortName?: string | null };
type ReportPlayer = { id: string; jersey: number | null; name: string };

export function ReportClient({
  matchId,
  meta,
  home,
  away,
  ourSide,
  players,
  initial,
  submitted: initiallySubmitted,
  submittedLabel = "Submitted",
  due,
  backHref,
  canEdit,
}: {
  matchId: number;
  meta: string;
  home: Side;
  away: Side;
  ourSide: "home" | "away";
  players: ReportPlayer[];
  initial: ReportDraft;
  submitted: boolean;
  /** "Submitted" or "Confirmed". */
  submittedLabel?: string;
  /** Weekday the report is due, e.g. "Tue". */
  due: string;
  backHref: string;
  canEdit: boolean;
}) {
  const [score, setScore] = useState({ home: initial.home, away: initial.away });
  const [stats, setStats] = useState<Record<string, Stat>>(initial.stats);
  const [cards, setCards] = useState<Record<string, CardColor | null>>(initial.cards);
  const [redNote, setRedNote] = useState(initial.redNote);
  const [triedSubmit, setTriedSubmit] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [submitted, setSubmitted] = useState(initiallySubmitted);
  const [toast, showToast] = useToast();
  const lock = submitted || !canEdit;

  const ours = ourSide === "home" ? home : away;
  const ourScore = score[ourSide];
  const goals = Object.values(stats).reduce((a, s) => a + (s.g || 0), 0);
  const hasRed = Object.values(cards).includes("r");
  const errors: string[] = [];
  if (goals !== ourScore) errors.push(`Player goals add up to ${goals}, but ${ours.name} scored ${ourScore}.`);
  if (hasRed && !redNote.trim()) errors.push("Describe the red card incident for the league office.");

  const bump = (j: string, k: keyof Stat, d: number) =>
    setStats((s) => {
      const cur = s[j] ?? { g: 0, a: 0 };
      return { ...s, [j]: { ...cur, [k]: Math.max(0, (cur[k] || 0) + d) } };
    });
  const toggleCard = (j: string, c: CardColor) => setCards((s) => ({ ...s, [j]: s[j] === c ? null : c }));

  const submit = () => {
    if (errors.length) {
      setTriedSubmit(true);
      return;
    }
    setConfirming(true);
  };

  const actions = lock ? (
    <ButtonLink href={backHref} variant="ghost" block>
      Back to overview
    </ButtonLink>
  ) : (
    <>
      <Button variant="ghost" onClick={() => showToast("Report draft saved")}>
        Save draft
      </Button>
      <Button className="grow" onClick={submit}>
        Submit final
      </Button>
    </>
  );

  const scoreInput = (side: "home" | "away", t: Side) => (
    <div className="flex flex-col items-center gap-2">
      <Crest team={t} />
      <b className="text-sm">{t.name}</b>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        aria-label={`${t.name} score`}
        value={score[side]}
        disabled={lock}
        onChange={(e) => setScore((s) => ({ ...s, [side]: Math.max(0, Number(e.target.value) || 0) }))}
        className="h-[76px] w-[76px] rounded-2xl border-2 border-line-strong bg-surface text-center font-display text-[44px] font-extrabold text-fg outline-none focus:border-pitch-2 focus:ring-[3px] focus:ring-lime/55 disabled:opacity-70"
      />
    </div>
  );

  const counter = (p: ReportPlayer, k: keyof Stat, label: string) => (
    <span className="inline-flex h-10 items-center overflow-hidden rounded-full border border-line-strong" role="group" aria-label={`${label} for ${p.name}`}>
      <button type="button" aria-label={`Fewer ${label.toLowerCase()}`} disabled={lock} onClick={() => bump(p.id, k, -1)} className="h-10 w-9 bg-surface-2 text-lg font-bold disabled:opacity-50">
        −
      </button>
      <span className="min-w-[30px] text-center font-display text-lg font-extrabold" aria-live="polite">
        {stats[p.id]?.[k] ?? 0}
      </span>
      <button type="button" aria-label={`More ${label.toLowerCase()}`} disabled={lock} onClick={() => bump(p.id, k, 1)} className="h-10 w-9 bg-surface-2 text-lg font-bold disabled:opacity-50">
        +
      </button>
    </span>
  );

  const cardToggle = (j: string, c: CardColor) => {
    const on = cards[j] === c;
    const onCls = c === "y" ? "border-solid border-[#C99F00] bg-[#F5C518] text-[#2B2100]" : "border-solid border-[#A11E15] bg-[#D92D20] text-white";
    return (
      <button
        type="button"
        aria-label={c === "y" ? "Yellow card" : "Red card"}
        aria-pressed={on}
        disabled={lock}
        onClick={() => toggleCard(j, c)}
        className={`h-10 w-[30px] rounded-[5px] border-[1.5px] text-[11px] font-extrabold disabled:opacity-60 ${on ? onCls : "border-dashed border-line-strong text-muted"}`}
      >
        {c.toUpperCase()}
      </button>
    );
  };

  return (
    <>
      <Screen width="wide" className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-7">
        <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-[200px] lg:col-start-2 lg:row-start-1">
          <Card className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="eyebrow">
                Game #{matchId} · {meta}
              </span>
              {submitted ? <Badge tone="ok">{submittedLabel}</Badge> : <Badge tone="warn">Draft · due {due}</Badge>}
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2.5 text-center">
              {scoreInput("home", home)}
              <span className="font-display text-[22px] font-extrabold text-muted">FT</span>
              {scoreInput("away", away)}
            </div>
          </Card>
          <div className="hidden gap-2.5 lg:flex [&>*]:flex-1">{actions}</div>
        </aside>

        <div className="flex min-w-0 flex-col gap-4 lg:col-start-1 lg:row-start-1">
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xl">Player stats</h3>
              <span className="text-xs text-muted">G · A · Cards</span>
            </div>
            <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
              {players.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-line px-3 py-2.5 last:border-b-0">
                  <span className="flex min-w-[120px] flex-1 items-center gap-2">
                    <Jersey n={jerseyLabel(p.jersey)} small />
                    <b className="truncate text-sm">{firstLast(p.name)}</b>
                  </span>
                  <span className="flex items-center gap-2">
                    {counter(p, "g", "Goals")}
                    {counter(p, "a", "Assists")}
                    {cardToggle(p.id, "y")}
                    {cardToggle(p.id, "r")}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {hasRed ? (
            <Field
              htmlFor="red-note"
              label={
                <>
                  Red card details <span className="text-bad">· required</span>
                </>
              }
            >
              <TextArea id="red-note" value={redNote} disabled={lock} onChange={(e) => setRedNote(e.target.value)} placeholder="Minute, what happened, referee’s call" />
            </Field>
          ) : null}

          {!lock && errors.length ? (
            <div className="flex flex-col gap-2" aria-live="polite">
              {errors.map((e) => (
                <Notice key={e} tone={triedSubmit ? "bad" : "warn"}>
                  {e}
                </Notice>
              ))}
            </div>
          ) : null}

          {submitted ? <Notice tone="ok">Report submitted. Standings and stats update after the league office confirms it.</Notice> : null}
        </div>
      </Screen>

      <ActionBar withTabs width="wide" className="lg:hidden">
        {actions}
      </ActionBar>

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Submit final report?"
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setSubmitted(true);
                setConfirming(false);
                showToast("Match report submitted");
              }}
            >
              Submit
            </Button>
          </>
        }
      >
        <p className="text-muted">
          {home.name} {score.home}–{score.away} {away.name}. After you submit, only the league office can change it.
        </p>
      </Dialog>
      <Toast message={toast} />
    </>
  );
}
