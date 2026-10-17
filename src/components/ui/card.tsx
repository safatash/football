import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./icon";

export function Card({ children, className = "", as: Tag = "div" }: { children: ReactNode; className?: string; as?: "div" | "section" | "article" }) {
  return <Tag className={`rounded-[var(--radius-card)] border border-line bg-surface p-4 ${className}`}>{children}</Tag>;
}

export function CardHeader({ title, action, className = "" }: { title: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={`mb-3 flex items-center justify-between gap-3 ${className}`}>
      <h3 className="text-[19px] font-bold">{title}</h3>
      {action}
    </div>
  );
}

/** Dark pitch-green feature card (next match, etc.) */
export function HeroCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`hero-ring rounded-[var(--radius-card)] bg-pitch p-[18px] text-on-pitch ${className}`}>{children}</div>;
}

export function StatCard({
  label,
  value,
  suffix,
  note,
  href,
  tone,
}: {
  label: string;
  value: ReactNode;
  suffix?: ReactNode;
  note?: ReactNode;
  href?: string;
  tone?: "pass" | "bad" | "ok";
}) {
  const valueColor = tone === "pass" ? "text-pass" : tone === "bad" ? "text-bad" : tone === "ok" ? "text-ok" : "";
  const inner = (
    <>
      <span className="text-[13px] font-semibold text-muted">{label}</span>
      <span className={`font-display text-[40px] leading-none font-extrabold ${valueColor}`}>
        {value}
        {suffix ? <span className="text-[22px] text-muted">{suffix}</span> : null}
      </span>
      {note ? <span className="text-xs text-faint">{note}</span> : null}
    </>
  );
  const cls = "flex flex-col gap-1 rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3.5 text-left";
  return href ? (
    <Link href={href} className={`${cls} transition-colors hover:border-line-strong`}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

const noticeTones = {
  info: "bg-info-bg text-info",
  warn: "bg-warn-bg text-warn",
  bad: "bg-bad-bg text-bad",
  ok: "bg-ok-bg text-ok",
  pass: "bg-pass-bg text-pass",
} as const;
const noticeIcons: Record<keyof typeof noticeTones, IconName> = { info: "info", warn: "alert", bad: "alert", ok: "check", pass: "ticket" };

export function Notice({
  tone = "info",
  icon,
  title,
  children,
  className = "",
}: {
  tone?: keyof typeof noticeTones;
  icon?: IconName;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-start gap-2.5 rounded-[var(--radius-field)] px-3.5 py-3 text-[13.5px] ${noticeTones[tone]} ${className}`} role={tone === "bad" ? "alert" : undefined}>
      <Icon name={icon ?? noticeIcons[tone]} className="mt-px size-[18px]" />
      <span>
        {title ? <b className="font-bold">{title} </b> : null}
        {children}
      </span>
    </div>
  );
}

export function EmptyState({ icon = "info", title, children, action }: { icon?: IconName; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] border-[1.5px] border-dashed border-line-strong px-4 py-7 text-center text-muted">
      <Icon name={icon} className="size-[30px] text-faint" />
      <b className="text-fg">{title}</b>
      {children ? <span className="text-sm">{children}</span> : null}
      {action}
    </div>
  );
}

/** Label/value list for detail pages */
export function KeyValue({ items }: { items: [ReactNode, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[110px_1fr] gap-x-3.5 gap-y-2.5 text-[14.5px] md:grid-cols-[140px_1fr]">
      {items.map(([k, v], i) => (
        <div key={i} className="contents">
          <dt className="font-semibold text-muted">{k}</dt>
          <dd className="font-semibold">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
