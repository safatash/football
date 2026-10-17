"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { Badge, GamePassTag } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { CheckBox, Dialog, Toast, useToast } from "@/components/ui/controls";
import { Icon } from "@/components/ui/icon";
import { Jersey, PosTag } from "@/components/league";
import { ActionBar, Screen } from "@/components/shell/layout";
import { reopenMatchRoster, saveMatchRoster } from "@/lib/actions/captain";
import type { SquadPlayer } from "@/lib/queries/captain";
import { AvailText, jerseyLabel } from "../../../roster-helpers";

type Warning = { tone: "bad" | "warn" | "pass"; title: string; text: string };

const timeLabel = (d: Date) =>
  `${d.toLocaleDateString("en-US", { weekday: "short" })} ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;

export function MatchRosterClient({
  teamId,
  matchDbId,
  matchId,
  kickoff,
  opponent,
  pool,
  initial,
  max,
  finalized = null,
  canEdit,
}: {
  teamId: string;
  /** Match id (database), used by the save actions. */
  matchDbId: string;
  matchId: number;
  kickoff: string;
  opponent: string;
  pool: SquadPlayer[];
  /** TeamRoster ids on the saved match roster. */
  initial: string[];
  max: number;
  /** When the saved roster was finalized, e.g. "Sat 7:12 PM". */
  finalized?: string | null;
  canEdit: boolean;
}) {
  const [sel, setSel] = useState<Set<string>>(() => new Set(initial));
  const [finalizedAt, setFinalizedAt] = useState<string | null>(finalized);
  const [confirming, setConfirming] = useState(false);
  const [toast, showToast] = useToast();
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const locked = finalizedAt !== null;

  const save = (finalize: boolean) =>
    startTransition(async () => {
      const res = await saveMatchRoster({ teamId, matchId: matchDbId, teamRosterIds: [...sel], finalize });
      if (!res.ok) return showToast(res.error);
      if (finalize) {
        setFinalizedAt(timeLabel(new Date()));
        setConfirming(false);
      }
      showToast(res.warnings?.length ? `${res.message} · ${res.warnings.length} warning${res.warnings.length > 1 ? "s" : ""}` : res.message);
      router.refresh();
    });
  const reopen = () =>
    startTransition(async () => {
      const res = await reopenMatchRoster({ teamId, matchId: matchDbId });
      if (!res.ok) return showToast(res.error);
      setFinalizedAt(null);
      showToast(res.message);
      router.refresh();
    });

  const season = pool.filter((p) => !p.gamePass);
  const passes = pool.filter((p) => p.gamePass);
  const n = sel.size;
  const passCount = passes.filter((p) => sel.has(p.id)).length;

  const warnings = useMemo<Warning[]>(() => {
    const w: Warning[] = [];
    pool.forEach((p) => {
      if (!sel.has(p.id)) return;
      if (p.suspended)
        w.push({
          tone: "bad",
          title: `${p.name} is suspended`,
          text: p.suspendedUntil ? `and can’t play until ${p.suspendedUntil}.` : "and can’t play until the league office lifts the suspension.",
        });
      else if (p.avail === "no")
        w.push({ tone: "warn", title: `${p.name} is marked unavailable`, text: `(${p.note ?? "no reason given"}). Keep them on only if they’ve confirmed.` });
      if (p.gamePass) w.push({ tone: "pass", title: `${p.name} is on a game pass.`, text: "Valid for this match only. Drops off after the final whistle." });
    });
    if (!pool.some((p) => p.pos === "GK" && sel.has(p.id))) w.push({ tone: "bad", title: "No goalkeeper selected.", text: "" });
    return w;
  }, [pool, sel]);
  const blocking = warnings.filter((w) => w.tone === "bad");

  const toggle = (p: SquadPlayer) => {
    if (locked || p.suspended || !canEdit) return;
    setSel((cur) => {
      const next = new Set(cur);
      if (next.has(p.id)) next.delete(p.id);
      else {
        if (next.size >= max) {
          showToast(`Match roster is full (${max}). Remove someone first.`);
          return cur;
        }
        next.add(p.id);
      }
      return next;
    });
  };

  const selectAllAvailable = () => setSel(new Set(pool.filter((p) => p.avail === "yes" && !p.suspended).map((p) => p.id).slice(0, max)));

  const actions = locked ? (
    <>
      <Button variant="ghost" disabled={!canEdit || pending} onClick={reopen}>
        Reopen
      </Button>
      <ButtonLink href={`/matches/${matchId}/print`} variant="accent" className="grow">
        <Icon name="print" className="size-4" />
        Print roster
      </ButtonLink>
    </>
  ) : (
    <>
      <Button variant="ghost" disabled={!canEdit || pending} onClick={() => save(false)}>
        {pending ? "Saving…" : "Save draft"}
      </Button>
      <Button className="grow" disabled={!canEdit || pending} onClick={() => setConfirming(true)}>
        Finalize roster
      </Button>
    </>
  );

  const row = (p: SquadPlayer): ReactNode => {
    const on = sel.has(p.id);
    const disabled = p.suspended || locked || !canEdit;
    return (
      <button
        key={p.id}
        type="button"
        role="checkbox"
        aria-checked={on}
        aria-disabled={disabled || undefined}
        onClick={() => toggle(p)}
        className={`flex min-h-[62px] w-full items-center gap-3 border-b border-line px-3.5 py-2.5 text-left last:border-b-0 ${
          disabled ? "cursor-default" : "cursor-pointer hover:bg-surface-2"
        } ${
          p.gamePass
            ? "bg-[linear-gradient(90deg,var(--pass-bg),transparent_70%)] shadow-[inset_3px_0_0_var(--pass)]"
            : on
              ? "bg-lime/12"
              : ""
        } ${p.suspended ? "opacity-60" : ""}`}
      >
        <span className={p.suspended ? "opacity-40" : ""}>
          <CheckBox checked={on} />
        </span>
        <Jersey n={jerseyLabel(p.jersey)} gamePass={p.gamePass} />
        <span className="min-w-0 flex-1">
          <b className="block text-sm">
            {p.name}
            {p.captain ? <span className="text-xs font-normal text-muted"> (C)</span> : null}
          </b>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <AvailText p={p} />
            {p.gamePass ? <GamePassTag /> : null}
          </span>
        </span>
        <PosTag pos={p.pos} />
      </button>
    );
  };

  return (
    <>
      <Screen width="wide" className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-7">
        <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-[200px] lg:col-start-2 lg:row-start-1">
          <Card className="flex flex-col gap-2.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="eyebrow">
                  Game #{matchId} · {kickoff}
                </span>
                <h2 className="text-2xl">vs {opponent}</h2>
              </div>
              {locked ? <Badge tone="ok">Finalized</Badge> : <Badge tone="warn">Draft</Badge>}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">Selected</span>
              <b className="font-display text-[30px] leading-none font-extrabold" aria-live="polite">
                {n}
                <span className="text-xl text-muted"> / {max}</span>
              </b>
            </div>
            <div
              className="h-2 overflow-hidden rounded bg-surface-3"
              role="progressbar"
              aria-label="Match roster size"
              aria-valuemin={0}
              aria-valuemax={max}
              aria-valuenow={n}
            >
              <div className={`h-full transition-[width] ${n > max ? "bg-bad" : "bg-pitch-2"}`} style={{ width: `${Math.min(100, (n / max) * 100)}%` }} />
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-muted">
              <span>Season players: {n - passCount}</span>
              <span>Game pass: {passCount}</span>
              <span>Max {max} per match</span>
            </div>
          </Card>

          {warnings.length ? (
            <div className="flex flex-col gap-2" aria-live="polite">
              {warnings.map((w) => (
                <Notice key={w.title} tone={w.tone} title={w.title}>
                  {w.text}
                </Notice>
              ))}
            </div>
          ) : null}

          {locked ? (
            <Notice tone="ok" icon="lock">
              Finalized {finalizedAt}. The referee and the league office have this roster. Reopen to make changes.
            </Notice>
          ) : null}

          <div className="hidden gap-2.5 lg:flex [&>*]:flex-1">{actions}</div>
        </aside>

        <div className="flex min-w-0 flex-col gap-4 lg:col-start-1 lg:row-start-1">
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <span className="eyebrow">Season roster · {season.length}</span>
              {locked || !canEdit ? null : (
                <Button variant="link" size="sm" onClick={selectAllAvailable}>
                  Select all available
                </Button>
              )}
            </div>
            <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">{season.map(row)}</div>
          </section>

          {passes.length ? (
            <section className="flex flex-col gap-2">
              <span className="eyebrow">Game pass · this match only</span>
              <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">{passes.map(row)}</div>
              <p className="text-xs text-muted">
                Game-pass players are added by the league when they buy a pass for this match. They don’t carry over to future matches.
              </p>
            </section>
          ) : null}
        </div>
      </Screen>

      <ActionBar withTabs width="wide" className="lg:hidden">
        {actions}
      </ActionBar>

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Finalize match roster?"
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Keep editing
            </Button>
            <Button
              disabled={blocking.length > 0 || pending}
              onClick={() => save(true)}
            >
              Finalize
            </Button>
          </>
        }
      >
        <p className="text-muted">
          {n} players for Game #{matchId}. The referee and {opponent}’s captain will see this roster.
        </p>
        {blocking.length ? (
          <Notice tone="bad">
            Fix {blocking.length} problem{blocking.length > 1 ? "s" : ""} before finalizing.
          </Notice>
        ) : null}
        {blocking.map((w) => (
          <Notice key={`b-${w.title}`} tone="bad" title={w.title}>
            {w.text}
          </Notice>
        ))}
        {warnings
          .filter((w) => w.tone !== "bad")
          .map((w) => (
            <Notice key={w.title} tone={w.tone} title={w.title}>
              {w.text}
            </Notice>
          ))}
      </Dialog>
      <Toast message={toast} />
    </>
  );
}
