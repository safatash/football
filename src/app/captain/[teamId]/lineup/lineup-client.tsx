"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Segmented, Toast, useToast } from "@/components/ui/controls";
import { ActionBar, Screen } from "@/components/shell/layout";
import { saveLineup } from "@/lib/actions/captain";
import type { SquadPlayer } from "@/lib/queries/captain";
import { firstLast, jerseyLabel } from "../roster-helpers";

/** Formation slot → TeamRoster id. */
type Slots = Record<string, string | null>;

function slotsFor(positions: [string, number, number][], players: string[]): Slots {
  return Object.fromEntries(positions.map(([pos], i) => [pos, players[i] ?? null]));
}

const DRAG_TYPE = "text/plain";

export function LineupClient({
  teamId,
  matchDbId,
  finalized,
  matchId,
  opponent,
  pool,
  selected,
  formations,
  initialFormation,
  initialSlots,
  canEdit,
}: {
  teamId: string;
  matchDbId: string;
  /** Lineups can only be saved from a finalized match roster. */
  finalized: boolean;
  matchId: number;
  opponent: string;
  pool: SquadPlayer[];
  selected: string[];
  formations: Record<string, [string, number, number][]>;
  initialFormation: string;
  initialSlots: Record<string, string>;
  canEdit: boolean;
}) {
  const [formation, setFormation] = useState(initialFormation);
  const [slots, setSlots] = useState<Slots>(() =>
    Object.fromEntries(formations[initialFormation].map(([pos]) => [pos, initialSlots[pos] ?? null])),
  );
  const [picked, setPicked] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [toast, showToast] = useToast();
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const save = () =>
    startTransition(async () => {
      const res = await saveLineup({ teamId, matchId: matchDbId, formation, slots });
      showToast(res.ok ? res.message : res.error);
      if (res.ok) router.refresh();
    });

  const byId = (id: string) => pool.find((p) => p.id === id);
  const selSet = new Set(selected);
  const placed = new Set(Object.values(slots).filter((j): j is string => j !== null));
  const playable = (p: SquadPlayer) => selSet.has(p.id) && !p.suspended && p.avail !== "no";
  const bench = pool.filter((p) => playable(p) && !placed.has(p.id));
  const inactive = pool.filter((p) => !playable(p));

  const place = (j: string, pos: string) =>
    setSlots((cur) => {
      const next: Slots = {};
      for (const k of Object.keys(cur)) next[k] = cur[k] === j ? null : cur[k];
      next[pos] = j;
      return next;
    });
  const toBench = (j: string) =>
    setSlots((cur) => Object.fromEntries(Object.entries(cur).map(([k, v]) => [k, v === j ? null : v])));

  const onSlot = (pos: string) => {
    if (!canEdit) return;
    const cur = slots[pos];
    if (picked !== null) {
      place(picked, pos);
      setPicked(null);
    } else if (cur !== null) {
      toBench(cur);
    }
  };

  const changeFormation = (k: string) => {
    const old = Object.values(slots).filter((j): j is string => j !== null);
    setFormation(k);
    setSlots(slotsFor(formations[k], old));
    setPicked(null);
  };

  const readDrag = (e: DragEvent) => e.dataTransfer.getData(DRAG_TYPE) || null;
  const startDrag = (e: DragEvent, j: string) => {
    e.dataTransfer.setData(DRAG_TYPE, j);
    e.dataTransfer.effectAllowed = "move";
  };

  const actions = (
    <>
      <Button variant="ghost" disabled={!canEdit} onClick={() => {
          setSlots(slotsFor(formations[formation], []));
          setPicked(null);
        }}>
        Clear
      </Button>
      <Button className="grow" disabled={!canEdit || !finalized || pending} onClick={save}>
        {pending ? "Saving…" : "Save lineup"}
      </Button>
    </>
  );

  const chip = (p: SquadPlayer, active: boolean) => {
    const isPicked = picked === p.id;
    return (
      <button
        key={p.id}
        type="button"
        disabled={!active}
        draggable={active}
        aria-pressed={active ? isPicked : undefined}
        onDragStart={active ? (e) => startDrag(e, p.id) : undefined}
        onClick={() => setPicked(isPicked ? null : p.id)}
        className={`inline-flex min-h-11 select-none items-center gap-2 rounded-full border-[1.5px] py-1.5 pr-3 pl-1.5 text-[13px] font-bold ${
          isPicked
            ? "border-lime bg-lime text-lime-ink"
            : p.gamePass
              ? "border-dashed border-pass bg-surface"
              : "border-line-strong bg-surface"
        } ${active ? "cursor-grab" : "cursor-default opacity-60"}`}
      >
        <span
          className={`grid size-[26px] place-items-center rounded-full font-display text-sm font-extrabold ${
            p.gamePass ? "bg-pass text-white" : "bg-surface-2"
          }`}
        >
          {jerseyLabel(p.jersey)}
        </span>
        {firstLast(p.name)}
        {p.gamePass ? " · GP" : ""}
      </button>
    );
  };

  return (
    <>
      <Screen width="wide" className="lg:grid lg:grid-cols-[minmax(0,520px)_minmax(0,1fr)] lg:items-start lg:gap-x-10">
        <div className="flex flex-col gap-3 lg:col-span-2">
          <div className="flex items-end justify-between gap-3">
            <div>
              <span className="eyebrow">
                Game #{matchId} · vs {opponent}
              </span>
              <h2 className="text-2xl">Starting XI</h2>
            </div>
            <span className="text-sm text-muted" aria-live="polite">
              <b className="font-display text-2xl text-fg">{placed.size}</b>/11
            </span>
          </div>
          {!finalized && canEdit ? (
            <Notice tone="warn" title="Match roster is still a draft.">
              Finalize the match roster for Game #{matchId}, then save your lineup.
            </Notice>
          ) : null}
          <Segmented
            label="Formation"
            className="max-w-[420px]"
            active={formation}
            onChange={changeFormation}
            items={Object.keys(formations).map((k) => ({ key: k, label: k }))}
          />
          <p className="text-sm text-muted" aria-live="polite">
            {picked !== null ? (
              <>
                <b className="text-fg">Tap a position</b> to place #{jerseyLabel(byId(picked)?.jersey ?? null)}.
              </>
            ) : (
              "Drag a player onto a position, or tap a player then a position. Tap a placed player to send them to the bench."
            )}
          </p>
        </div>

        <div className="pitch-grass relative aspect-[68/88] w-full max-w-[520px] overflow-hidden rounded-2xl">
          <svg className="absolute inset-0 size-full" viewBox="0 0 68 88" preserveAspectRatio="none" aria-hidden>
            <g fill="none" stroke="rgba(255,255,255,.7)" strokeWidth=".35">
              <rect x="2" y="2" width="64" height="84" />
              <path d="M2 44h64" />
              <circle cx="34" cy="44" r="7" />
              <rect x="16" y="2" width="36" height="13" />
              <rect x="25" y="2" width="18" height="5" />
              <rect x="16" y="73" width="36" height="13" />
              <rect x="25" y="81" width="18" height="5" />
            </g>
          </svg>
          {formations[formation].map(([pos, x, y]) => {
            const j = slots[pos];
            const p = j !== null ? byId(j) : undefined;
            const target = picked !== null && !p;
            const over = dragOver === pos;
            return (
              <button
                key={pos}
                type="button"
                aria-label={`${pos}${p ? `: ${p.name}` : ": empty"}`}
                draggable={!!p && canEdit}
                onDragStart={p && canEdit ? (e) => startDrag(e, p.id) : undefined}
                onDragOver={(e) => {
                  if (!canEdit) return;
                  e.preventDefault();
                  setDragOver(pos);
                }}
                onDragLeave={() => setDragOver((d) => (d === pos ? null : d))}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(null);
                  const dj = readDrag(e);
                  if (dj) place(dj, pos);
                  setPicked(null);
                }}
                onClick={() => onSlot(pos)}
                className="absolute flex w-[70px] -translate-x-1/2 -translate-y-1/2 cursor-pointer flex-col items-center gap-[3px]"
                style={{ left: `${x}%`, top: `${y}%` }}
              >
                <span
                  className={`grid size-11 place-items-center rounded-full border-2 font-display text-[19px] font-extrabold ${
                    p
                      ? p.gamePass
                        ? "border-white bg-pass text-white"
                        : "border-white bg-white text-[#0F3D2E]"
                      : "border-dashed border-white/80 bg-black/10 text-white"
                  } ${target || over ? "!border-lime shadow-[0_0_0_4px_rgba(200,240,74,.45)]" : ""}`}
                >
                  {p ? jerseyLabel(p.jersey) : ""}
                </span>
                <span className="max-w-[76px] truncate text-[11px] font-bold text-white [text-shadow:0_1px_2px_rgba(0,0,0,.6)]">
                  {p ? p.name.split(" ").slice(1).join(" ") : ""}
                </span>
                <span className="text-[9.5px] font-extrabold tracking-[0.08em] text-white/85">{pos}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-4">
          <section
            className={`flex flex-col gap-2 rounded-[var(--radius-card)] p-1 ${dragOver === "bench" ? "bg-lime/15" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver("bench");
            }}
            onDragLeave={() => setDragOver((d) => (d === "bench" ? null : d))}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(null);
              const dj = readDrag(e);
              if (dj) toBench(dj);
              setPicked(null);
            }}
          >
            <span className="eyebrow">Bench · {bench.length}</span>
            <div className="flex flex-wrap gap-2">
              {bench.length ? bench.map((p) => chip(p, canEdit)) : <span className="text-sm text-muted">Everyone on the match roster is in the XI.</span>}
            </div>
          </section>
          <section className="flex flex-col gap-2 p-1">
            <span className="eyebrow">Not playing · {inactive.length}</span>
            <div className="flex flex-wrap gap-2">{inactive.map((p) => chip(p, false))}</div>
          </section>
          <div className="hidden gap-2.5 lg:flex [&>*]:flex-1">{actions}</div>
        </div>
      </Screen>
      <ActionBar withTabs width="wide" className="lg:hidden">
        {actions}
      </ActionBar>
      <Toast message={toast} />
    </>
  );
}
