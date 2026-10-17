"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/icon";
import { Logo } from "@/components/league";

type NavItem = { href: string; label: string; icon: IconName; match: (p: string) => boolean };

function items(teamHref: string): NavItem[] {
  return [
    { href: "/portal", label: "Home", icon: "home", match: (p) => p === "/portal" },
    { href: teamHref, label: "My team", icon: "users", match: (p) => p.startsWith("/captain") || p.startsWith("/portal/team") },
    { href: "/portal/registrations", label: "Registrations", icon: "clip", match: (p) => p.startsWith("/portal/registrations") },
    { href: "/portal/profile", label: "Profile", icon: "user", match: (p) => p.startsWith("/portal/profile") },
  ];
}

/** Desktop: top bar. Hidden below lg. */
export function TopNav({ teamHref, initials, season }: { teamHref: string; initials: string; season: string }) {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="sticky top-0 z-30 hidden min-h-[60px] items-center gap-1.5 border-b border-line bg-surface px-[max(16px,calc((100%-1120px)/2))] lg:flex">
      <Logo href="/portal" className="mr-4" />
      {items(teamHref).map((it) => (
        <Link
          key={it.label}
          href={it.href}
          aria-current={it.match(path) ? "page" : undefined}
          className={`rounded-full px-3.5 py-2 text-[14.5px] font-bold ${it.match(path) ? "bg-pitch-tint text-fg" : "text-muted hover:bg-surface-2 hover:text-fg"}`}
        >
          {it.label}
        </Link>
      ))}
      <span className="flex-1" />
      <span className="mr-2 text-sm text-muted">{season}</span>
      <Link href="/portal/profile" aria-label="Your profile" className="grid size-[34px] place-items-center rounded-full bg-lime text-[13px] font-bold text-lime-ink">
        {initials}
      </Link>
    </nav>
  );
}

/** Mobile: bottom tabs. Hidden from lg. */
export function BottomTabs({ teamHref }: { teamHref: string }) {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="sticky bottom-0 z-30 grid grid-cols-4 border-t border-line bg-surface px-1.5 pt-1.5 pb-[calc(8px+env(safe-area-inset-bottom))] lg:hidden">
      {items(teamHref).map((it) => {
        const on = it.match(path);
        return (
          <Link key={it.label} href={it.href} aria-current={on ? "page" : undefined} className={`flex flex-col items-center gap-[3px] rounded-[10px] py-1.5 text-[11.5px] font-bold ${on ? "text-fg" : "text-muted"}`}>
            <span className={`grid h-7 w-[50px] place-items-center rounded-full ${on ? "bg-pitch-tint text-pitch-2" : ""}`}>
              <Icon name={it.icon} className="size-[22px]" />
            </span>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Public pages: desktop top bar with sign-in actions. */
export function PublicTopNav() {
  return (
    <nav aria-label="NVASA" className="sticky top-0 z-30 hidden min-h-[60px] items-center gap-1.5 border-b border-line bg-surface px-[max(16px,calc((100%-1120px)/2))] lg:flex">
      <Logo />
      <span className="flex-1" />
      <Link href="/#fees" className="rounded-full px-3.5 py-2 text-[14.5px] font-bold text-muted hover:bg-surface-2 hover:text-fg">
        Divisions & fees
      </Link>
      <Link href="/login" className="rounded-full px-3.5 py-2 text-[14.5px] font-bold text-muted hover:bg-surface-2 hover:text-fg">
        Log in
      </Link>
      <Link href="/register" className="ml-1 inline-flex min-h-9 items-center rounded-full bg-lime px-3.5 text-[13.5px] font-bold text-lime-ink hover:bg-lime-2">
        Register
      </Link>
    </nav>
  );
}

/** Captain sub-navigation (tabs). */
export function CaptainTabs({ matchId = 204, reportMatchId = 203 }: { matchId?: number; reportMatchId?: number }) {
  const path = usePathname();
  const tabs = [
    { href: "/captain", label: "Overview", on: path === "/captain" },
    { href: "/captain/team", label: "Roster", on: path.startsWith("/captain/team") },
    { href: `/captain/matches/${matchId}/roster`, label: "Match roster", on: path.endsWith("/roster") && path.includes("/matches/") },
    { href: "/captain/lineup", label: "Lineup", on: path.startsWith("/captain/lineup") },
    { href: `/captain/matches/${reportMatchId}/report`, label: "Match report", on: path.endsWith("/report") },
  ];
  return (
    <div role="tablist" aria-label="Captain tools" className="no-scrollbar sticky top-[58px] z-20 flex gap-1.5 overflow-x-auto border-b border-line bg-bg px-[max(16px,calc((100%-1120px)/2))] py-2.5 lg:top-[124px]">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} role="tab" aria-selected={t.on} className={`whitespace-nowrap rounded-full px-3.5 py-2 text-[13.5px] font-bold ${t.on ? "bg-fg text-bg" : "text-muted hover:text-fg"}`}>
          {t.label}
        </Link>
      ))}
    </div>
  );
}
