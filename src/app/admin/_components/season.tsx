import Link from "next/link";
import { Fragment } from "react";
import { Notice } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { ACTIVE_SEASON } from "@/lib/league-data";

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** First value of a query param. */
export const param = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Season selected in the admin top bar (`?season=`), defaulting to the active season. */
export function seasonFrom(sp: Record<string, string | string[] | undefined>) {
  const s = param(sp.season).trim();
  return s || ACTIVE_SEASON;
}

export const isArchived = (season: string) => season !== ACTIVE_SEASON;

/** Keeps an archived season selected when following an admin link. */
export function withSeason(href: string, season: string) {
  if (!isArchived(season)) return href;
  return `${href}${href.includes("?") ? "&" : "?"}season=${encodeURIComponent(season)}`;
}

/** Shown on admin pages with actions when a closed season is selected. */
export function ArchivedNotice({ season }: { season: string }) {
  if (!isArchived(season)) return null;
  return (
    <Notice tone="info">
      You’re viewing <b>{season}</b>. It’s closed, so changes are turned off. Switch to {ACTIVE_SEASON} to make changes.
    </Notice>
  );
}

export function Crumbs({ items }: { items: [string, string?][] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-[13px] font-semibold text-muted">
      {items.map(([label, href], i) => (
        <Fragment key={i}>
          {href ? (
            <Link href={href} className="font-bold text-pitch-2 hover:underline">
              {label}
            </Link>
          ) : (
            <span aria-current="page">{label}</span>
          )}
          {i < items.length - 1 ? <Icon name="right" className="size-[13px]" /> : null}
        </Fragment>
      ))}
    </nav>
  );
}
