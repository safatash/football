import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { RoleTag } from "@/components/ui/badge";
import { Crest } from "@/components/league";

/** Horizontal gutter that also centers content at a max width. */
export const gutter = {
  narrow: "px-[max(16px,calc((100%-720px)/2))]",
  wide: "px-[max(16px,calc((100%-1120px)/2))]",
};

/**
 * Sticky page header (mobile app bar). Sits under the desktop top nav from lg.
 * `dark` = pitch green (dashboards, team views).
 */
export function AppBar({
  title,
  backHref,
  right,
  dark,
  width = "narrow",
  children,
}: {
  title?: ReactNode;
  backHref?: string;
  right?: ReactNode;
  dark?: boolean;
  width?: "narrow" | "wide";
  children?: ReactNode;
}) {
  return (
    <header
      className={`sticky top-0 z-20 flex min-h-[58px] items-center gap-2.5 py-2.5 lg:top-[60px] lg:min-h-16 ${gutter[width]} ${
        dark ? "bg-pitch text-on-pitch" : "border-b border-line bg-bg"
      }`}
    >
      {backHref ? (
        <Link
          href={backHref}
          aria-label="Back"
          className={`grid size-10 shrink-0 place-items-center rounded-full border ${dark ? "border-white/20 bg-white/10 text-white" : "border-line bg-surface"}`}
        >
          <Icon name="left" />
        </Link>
      ) : null}
      {children ?? <div className="min-w-0 flex-1 truncate font-display text-[21px] font-extrabold">{title}</div>}
      {right}
    </header>
  );
}

/** Main content column. */
export function Screen({ children, width = "narrow", className = "" }: { children: ReactNode; width?: "narrow" | "wide"; className?: string }) {
  return <main className={`flex w-full flex-1 flex-col gap-4 pt-[18px] pb-7 lg:gap-5 lg:pt-8 ${gutter[width]} ${className}`}>{children}</main>;
}

/**
 * Primary actions. Pinned to the bottom on phones (above the tab bar when `withTabs`);
 * inline and right-aligned on desktop.
 */
export function ActionBar({ children, withTabs, width = "narrow", className = "" }: { children: ReactNode; withTabs?: boolean; width?: "narrow" | "wide"; className?: string }) {
  return (
    <div
      className={`sticky z-10 flex gap-2.5 bg-gradient-to-t from-bg from-75% to-transparent pt-4 pb-[18px] lg:static lg:justify-end lg:bg-none lg:pt-1 lg:pb-10 [&>*]:flex-1 lg:[&>*]:flex-none lg:[&>*]:min-w-40 ${
        withTabs ? "bottom-[calc(64px+env(safe-area-inset-bottom))]" : "bottom-0"
      } ${gutter[width]} ${className}`}
    >
      {children}
    </div>
  );
}

/** Dark team header shown on every team view, with the viewer's access level. */
export function TeamHeader({ teamId, name, sub, role, backHref = "/portal" }: { teamId?: string; name: string; sub: string; role: "Captain" | "Player"; backHref?: string }) {
  return (
    <AppBar dark width="wide" backHref={backHref}>
      <Crest teamId={teamId} name={name} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-[19px] font-extrabold lg:text-[22px]">{name}</div>
        <div className="truncate text-xs opacity-80">{sub}</div>
      </div>
      <RoleTag role={role} />
    </AppBar>
  );
}
