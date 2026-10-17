import type { ReactNode } from "react";
import { Icon } from "./icon";

export type Tone = "ok" | "warn" | "bad" | "pass" | "info" | "neutral";

const tones: Record<Tone, string> = {
  ok: "bg-ok-bg text-ok",
  warn: "bg-warn-bg text-warn",
  bad: "bg-bad-bg text-bad",
  pass: "bg-pass-bg text-pass",
  info: "bg-info-bg text-info",
  neutral: "bg-neutral-bg text-muted",
};

export function Badge({ tone = "neutral", dot = true, children, className = "" }: { tone?: Tone; dot?: boolean; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-bold ${tones[tone]} ${className}`}>
      {dot ? <span className="size-1.5 rounded-full bg-current" aria-hidden /> : null}
      {children}
    </span>
  );
}

/* ---------- Domain badges: accept either Prisma enum values or display labels ---------- */

const humanize = (s: string) =>
  s.includes("_") || s === s.toUpperCase()
    ? s
        .toLowerCase()
        .split("_")
        .map((w, i) => (i === 0 ? w[0].toUpperCase() + w.slice(1) : w))
        .join(" ")
    : s;

/** Registration: Submitted → Pending Review → Approved / Denied */
export function RegistrationBadge({ status }: { status: string }) {
  const map: Record<string, [string, Tone]> = {
    SUBMITTED: ["Submitted", "info"],
    PENDING: ["Pending review", "warn"],
    NEEDS_REVIEW: ["Pending review", "warn"],
    "PENDING REVIEW": ["Pending review", "warn"],
    APPROVED: ["Approved", "ok"],
    REJECTED: ["Denied", "bad"],
    DENIED: ["Denied", "bad"],
    CANCELLED: ["Cancelled", "neutral"],
    "GAME PASS ONLY": ["Game pass only", "pass"],
  };
  const [label, tone] = map[status.toUpperCase()] ?? [humanize(status), "neutral"];
  return <Badge tone={tone}>{label}</Badge>;
}

/** Payment: Unpaid / Pending / Paid */
export function PaymentBadge({ status }: { status: string }) {
  const map: Record<string, [string, Tone]> = {
    PAID: ["Paid", "ok"],
    PENDING: ["Payment pending", "warn"],
    UNPAID: ["Unpaid", "bad"],
    FAILED: ["Payment failed", "bad"],
    REFUNDED: ["Refunded", "neutral"],
  };
  const [label, tone] = map[status.toUpperCase()] ?? [humanize(status), "neutral"];
  return <Badge tone={tone}>{label}</Badge>;
}

/** Player: Active / Pending Approval / Suspended */
export function PlayerStatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, Tone]> = {
    ACTIVE: ["Active", "ok"],
    "PENDING APPROVAL": ["Pending approval", "warn"],
    PENDING: ["Pending approval", "warn"],
    SUSPENDED: ["Suspended", "bad"],
    INACTIVE: ["Inactive", "neutral"],
  };
  const [label, tone] = map[status.toUpperCase()] ?? [humanize(status), "neutral"];
  return <Badge tone={tone}>{label}</Badge>;
}

export function MatchStatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, Tone]> = {
    SCHEDULED: ["Scheduled", "warn"],
    IN_PROGRESS: ["In progress", "info"],
    COMPLETED: ["Completed", "ok"],
    CANCELLED: ["Cancelled", "bad"],
    POSTPONED: ["Postponed", "neutral"],
    SUBMITTED: ["Submitted", "ok"],
    CONFIRMED: ["Confirmed", "ok"],
    NOT_STARTED: ["Not started", "neutral"],
    FINALIZED: ["Finalized", "ok"],
    DRAFT: ["Draft", "warn"],
    OVERDUE: ["Overdue", "bad"],
    DUE: ["Due", "bad"],
    "NOT STARTED": ["Not started", "neutral"],
  };
  const [label, tone] = map[status.toUpperCase()] ?? [humanize(status), "neutral"];
  return <Badge tone={tone}>{label}</Badge>;
}

/** Game pass: Active for match day / Expired after match */
export function GamePassStatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase();
  if (s === "ACTIVE") return <Badge tone="ok">Active for match day</Badge>;
  if (s === "EXPIRED" || s === "USED") return <Badge tone="bad">Expired</Badge>;
  if (s === "CANCELLED") return <Badge tone="neutral">Cancelled</Badge>;
  return <Badge>{humanize(status)}</Badge>;
}

/** Access level on a team. Shown on every team view. */
export function RoleTag({ role }: { role: "Captain" | "Player" | "Admin" }) {
  const cls =
    role === "Captain" ? "bg-lime text-lime-ink" : role === "Admin" ? "bg-pitch text-on-pitch" : "bg-surface-3 text-fg";
  return (
    <span className={`inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-md px-2.5 text-[11.5px] font-extrabold uppercase tracking-[0.06em] ${cls}`}>
      {role === "Captain" ? <Icon name="star" className="size-3" /> : null}
      {role}
    </span>
  );
}

/** Marks a game-pass player wherever rosters appear. */
export function GamePassTag({ children = "Game pass · This match only" }: { children?: ReactNode }) {
  return (
    <span className="inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-md border-[1.5px] border-dashed border-pass bg-pass-bg px-2 text-xs font-bold text-pass">
      <Icon name="ticket" className="size-3.5" />
      {children}
    </span>
  );
}
