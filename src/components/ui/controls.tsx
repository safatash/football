"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./icon";

/* ---------- Radio cards ---------- */
export type Choice<T extends string> = { value: T; label: ReactNode; sub?: ReactNode; disabled?: boolean };

export function ChoiceGroup<T extends string>({
  name,
  value,
  onChange,
  options,
  columns = "auto",
}: {
  name: string;
  value: T | "";
  onChange: (v: T) => void;
  options: Choice<T>[];
  columns?: "auto" | 2 | 3 | 4;
}) {
  const grid =
    columns === "auto" ? "grid-cols-[repeat(auto-fit,minmax(120px,1fr))]" : { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-2 sm:grid-cols-4" }[columns];
  return (
    <div role="radiogroup" aria-label={name} className={`grid gap-2 ${grid}`}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={`relative flex min-h-12 flex-col justify-center gap-0.5 rounded-[var(--radius-field)] border-[1.5px] bg-surface px-3.5 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
              on ? "border-pitch-2 bg-pitch-tint shadow-[inset_0_0_0_1px_var(--pitch-2)]" : "border-line-strong hover:border-pitch-2"
            }`}
          >
            <b className="text-[14.5px]">{o.label}</b>
            {o.sub ? <span className="text-[12.5px] text-muted">{o.sub}</span> : null}
            {on ? (
              <span className="absolute right-2.5 top-2.5 grid size-4 place-items-center rounded-full bg-pitch-2 text-white">
                <Icon name="check" className="size-3" />
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Checkbox row ---------- */
export function CheckRow({ checked, onChange, title, sub }: { checked: boolean; onChange: (v: boolean) => void; title: ReactNode; sub?: ReactNode }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} onClick={() => onChange(!checked)} className="flex w-full items-start gap-3 py-2.5 text-left">
      <CheckBox checked={checked} />
      <span className="flex flex-col gap-0.5">
        <b className="text-[14.5px]">{title}</b>
        {sub ? <span className="text-[13px] text-muted">{sub}</span> : null}
      </span>
    </button>
  );
}

export function CheckBox({ checked, round }: { checked: boolean; round?: boolean }) {
  return (
    <span
      aria-hidden
      className={`mt-px grid size-[22px] shrink-0 place-items-center border-2 ${round ? "rounded-full" : "rounded-md"} ${
        checked ? "border-pitch-2 bg-pitch-2 text-white" : "border-line-strong bg-surface"
      }`}
    >
      {checked ? <Icon name="check" className="size-3.5 stroke-[3]" /> : null}
    </span>
  );
}

/* ---------- Switch ---------- */
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-[46px] shrink-0 rounded-full transition-colors disabled:opacity-45 ${checked ? "bg-pitch-2" : "bg-surface-3"}`}
    >
      <span className={`absolute top-[3px] size-[22px] rounded-full bg-white shadow transition-[left] ${checked ? "left-[21px]" : "left-[3px]"}`} />
    </button>
  );
}

/* ---------- Segmented control (buttons or links) ---------- */
export type Segment = { key: string; label: ReactNode; href?: string };

export function Segmented({ items, active, onChange, label, className = "" }: { items: Segment[]; active: string; onChange?: (k: string) => void; label: string; className?: string }) {
  return (
    <div role="tablist" aria-label={label} className={`no-scrollbar flex max-w-full gap-0.5 overflow-x-auto rounded-full bg-surface-2 p-1 ${className}`}>
      {items.map((it) => {
        const on = it.key === active;
        const cls = `flex-1 min-h-9 whitespace-nowrap rounded-full px-3.5 py-2 text-center text-[13.5px] font-bold transition ${
          on ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg"
        }`;
        return it.href ? (
          <Link key={it.key} role="tab" aria-selected={on} href={it.href} className={cls} scroll={false}>
            {it.label}
          </Link>
        ) : (
          <button key={it.key} type="button" role="tab" aria-selected={on} className={cls} onClick={() => onChange?.(it.key)}>
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Dialog ---------- */
export function Dialog({ open, onClose, title, children, actions }: { open: boolean; onClose: () => void; title: string; children?: ReactNode; actions: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    ref.current?.querySelector<HTMLElement>("button, [href], input, select, textarea")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(8,16,12,.55)] p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="dialog-title" className="flex max-h-[calc(100vh-32px)] w-full max-w-[440px] flex-col gap-3.5 overflow-auto rounded-[22px] bg-surface p-[22px] shadow-2xl">
        <h2 id="dialog-title" className="text-[26px]">
          {title}
        </h2>
        {children}
        <div className="flex flex-wrap justify-end gap-2.5">{actions}</div>
      </div>
    </div>
  );
}

/* ---------- Toast ---------- */
export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="fixed bottom-[calc(140px+env(safe-area-inset-bottom))] left-1/2 z-[60] flex max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-2 rounded-full bg-fg px-[18px] py-3 text-sm font-bold text-bg shadow-2xl lg:bottom-7"
    >
      <Icon name="check" />
      {message}
    </div>
  );
}

/** const [toast, showToast] = useToast(); ... <Toast message={toast} /> */
export function useToast(ms = 2600): [string | null, (msg: string) => void] {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback(
    (m: string) => {
      setMsg(m);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setMsg(null), ms);
    },
    [ms],
  );
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return [msg, show];
}
