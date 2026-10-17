import Link from "next/link";
import type { ReactNode } from "react";

export function TableWrap({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface ${className}`}>{children}</div>;
}

export function DataTable({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <table className={`w-full border-collapse text-left text-[14.5px] ${className}`}>{children}</table>;
}

export function TableHead({ children }: { children: ReactNode }) {
  return <thead>{children}</thead>;
}

export function HeadCell({ children, align = "left", className = "" }: { children?: ReactNode; align?: "left" | "right" | "center"; className?: string }) {
  return (
    <th
      scope="col"
      className={`whitespace-nowrap border-b border-line bg-surface-2 px-3.5 py-3 text-xs font-bold uppercase tracking-[0.06em] text-muted ${
        align === "right" ? "text-right" : align === "center" ? "text-center" : ""
      } ${className}`}
    >
      {children}
    </th>
  );
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody className="[&>tr:last-child>td]:border-b-0">{children}</tbody>;
}

/** Row; pass href to make the whole row a link target (first cell carries the real <Link>). */
export function BodyRow({ children, highlight, className = "" }: { children: ReactNode; highlight?: boolean; className?: string }) {
  return <tr className={`group relative ${highlight ? "bg-lime/15" : "hover:bg-surface-2"} ${className}`}>{children}</tr>;
}

export function BodyCell({ children, className = "", align = "left" }: { children?: ReactNode; className?: string; align?: "left" | "right" | "center" }) {
  return (
    <td className={`border-b border-line px-3.5 py-3 align-middle ${align === "right" ? "text-right" : align === "center" ? "text-center" : ""} ${className}`}>
      {children}
    </td>
  );
}

/** Link that stretches over its table row so the entire row is clickable. Use in the first cell. */
export function RowLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-bold after:absolute after:inset-0 after:content-[''] hover:underline">
      {children}
    </Link>
  );
}

export function FilterChip({ href, active, children, count }: { href: string; active: boolean; children: ReactNode; count?: number }) {
  return (
    <Link
      href={href}
      scroll={false}
      className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13.5px] font-semibold ${
        active ? "border-fg bg-fg text-bg" : "border-line-strong bg-surface hover:bg-surface-2"
      }`}
    >
      {children}
      {count !== undefined ? <span className="text-[11.5px] opacity-70">{count}</span> : null}
    </Link>
  );
}
