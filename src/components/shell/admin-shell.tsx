"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { Badge, RoleTag } from "@/components/ui/badge";
import { Logo } from "@/components/league";

type Item = { href: string; label: string; icon: IconName; count?: number };

export function AdminShell({
  children,
  user,
  counts,
  seasons,
  activeSeason,
  closedSeasons = [],
  divisionsHref,
}: {
  children: ReactNode;
  user: { name: string; title: string };
  counts: { registrations: number; placement: number };
  seasons: string[];
  activeSeason: string;
  /** Seasons that are over (read-only). Others besides the active one are upcoming. */
  closedSeasons?: string[];
  divisionsHref: string;
}) {
  const path = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const picked = params.get("season");
  const season = picked && seasons.includes(picked) ? picked : activeSeason;

  const groups: [string, Item[]][] = [
    ["Today", [{ href: "/admin", label: "Operations", icon: "grid" }]],
    [
      "Review",
      [
        { href: "/admin/registrations", label: "Registrations", icon: "clip", count: counts.registrations },
        { href: "/admin/placements", label: "Placement", icon: "flag", count: counts.placement },
      ],
    ],
    [
      "League",
      [
        { href: "/admin/players", label: "Players", icon: "users" },
        { href: "/admin/teams", label: "Teams", icon: "shield" },
        { href: "/admin/matches", label: "Matches", icon: "cal" },
        { href: "/admin/standings", label: "Standings", icon: "trophy" },
        { href: divisionsHref, label: "Divisions", icon: "list" },
        { href: "/admin/referees", label: "Referees", icon: "whistle" },
      ],
    ],
    [
      "Settings",
      [
        { href: "/admin/settings/league", label: "League profile", icon: "shield" },
        { href: "/admin/settings/staff", label: "Staff", icon: "users" },
        { href: "/admin/seasons", label: "Seasons", icon: "cal" },
        { href: "/admin/settings", label: "Fees & eligibility", icon: "card" },
        { href: "/admin/settings/fields", label: "Fields", icon: "pin" },
        { href: "/admin/settings/payments", label: "Payments", icon: "list" },
      ],
    ],
  ];
  const isOn = (href: string) =>
    href === "/admin" || href === "/admin/settings" ? path === href : path.startsWith(href.startsWith("/admin/divisions") ? "/admin/divisions" : href);

  function changeSeason(s: string) {
    const q = new URLSearchParams(params.toString());
    if (s === activeSeason) q.delete("season");
    else q.set("season", s);
    router.push(`${path}${q.size ? `?${q}` : ""}`);
  }

  return (
    <div className="grid min-h-screen bg-bg lg:grid-cols-[248px_minmax(0,1fr)]">
      <nav
        aria-label="League office"
        className="no-scrollbar sticky top-0 z-30 flex gap-0.5 overflow-x-auto bg-pitch px-4 py-2 text-white lg:h-screen lg:flex-col lg:gap-1 lg:overflow-y-auto lg:px-3.5 lg:py-[18px]"
      >
        <div className="hidden items-center gap-2 px-2 pb-[18px] lg:flex">
          <Logo href="/admin" tone="light" />
          <span className="text-xs font-semibold opacity-70">League office</span>
        </div>
        {groups.map(([g, list]) => (
          <div key={g} className="contents">
            <div className="hidden px-2.5 pt-3.5 pb-1.5 text-[11px] font-bold tracking-[0.1em] text-white/60 uppercase lg:block">{g}</div>
            {list.map((it) => (
              <Link
                key={it.href}
                href={it.href}
                aria-current={isOn(it.href) ? "page" : undefined}
                className={`flex items-center gap-2.5 whitespace-nowrap rounded-[9px] px-3 py-2 text-[14.5px] font-semibold lg:px-2.5 ${
                  isOn(it.href) ? "bg-white/15 text-white" : "text-white/85 hover:bg-white/10"
                }`}
              >
                <Icon name={it.icon} />
                {it.label}
                {it.count ? <span className="ml-auto rounded-full bg-lime px-2 text-[11.5px] font-extrabold text-lime-ink">{it.count}</span> : null}
              </Link>
            ))}
          </div>
        ))}
        <div className="hidden flex-1 lg:block" />
        <div className="mt-2.5 hidden items-center gap-2.5 border-t border-white/15 p-2.5 lg:flex">
          <span className="grid size-[34px] place-items-center rounded-full bg-white/15 text-[13px] font-bold">
            {user.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold">{user.name}</div>
            <div className="text-xs opacity-75">{user.title}</div>
          </div>
        </div>
      </nav>

      <div className="flex min-w-0 flex-col">
        <div className="flex flex-wrap items-center gap-3 border-b border-line bg-surface px-4 py-3 lg:sticky lg:top-0 lg:z-20 lg:px-7">
          <label className="flex h-[38px] items-center gap-2 rounded-full border border-line-strong bg-surface pr-1.5 pl-3 text-sm font-bold">
            <Icon name="cal" />
            <span className="sr-only">Season</span>
            <select value={season} onChange={(e) => changeSeason(e.target.value)} className="h-[34px] cursor-pointer bg-transparent font-bold outline-none">
              {seasons.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          {season === activeSeason ? <Badge tone="ok">Active season</Badge> : closedSeasons.includes(season) ? <Badge tone="info">Archived · read only</Badge> : <Badge tone="info">Upcoming season</Badge>}
          <form action="/admin/players" className="relative ml-auto min-w-[180px] max-w-[320px] flex-1">
            <Icon name="search" className="absolute top-2.5 left-3.5 size-[18px] text-muted" />
            <input
              name="q"
              placeholder="Search players"
              aria-label="Search players"
              className="h-[38px] w-full rounded-full border-[1.5px] border-line-strong bg-surface pl-10 pr-3.5 text-sm outline-none focus:border-pitch-2"
            />
          </form>
          <RoleTag role="Admin" />
        </div>
        <main className="flex min-w-0 flex-col gap-5 px-4 pt-5 pb-12 lg:px-7 lg:pt-6">{children}</main>
      </div>
    </div>
  );
}
