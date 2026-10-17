import Link from "next/link";
import { notFound } from "next/navigation";
import { Fragment } from "react";
import { Notice } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { resolveSeason, type ResolvedSeason } from "@/lib/queries/season";

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;
export type AdminSeason = ResolvedSeason;

/** First value of a query param. */
export const param = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Season selected in the admin top bar (`?season=`), defaulting to the active season. */
export async function seasonFrom(sp: Record<string, string | string[] | undefined>): Promise<AdminSeason> {
  const season = await resolveSeason(param(sp.season).trim() || null);
  if (!season) notFound();
  return season;
}

/** Keeps an archived season selected when following an admin link. */
export function withSeason(href: string, season: AdminSeason) {
  if (!season.archived) return href;
  return `${href}${href.includes("?") ? "&" : "?"}season=${encodeURIComponent(season.name)}`;
}

/** Shown on admin pages with actions when a closed season is selected. */
export function ArchivedNotice({ season }: { season: AdminSeason }) {
  if (!season.archived) return null;
  return (
    <Notice tone="info">
      You’re viewing <b>{season.name}</b>. It’s closed, so changes are turned off. Switch to {season.activeName} to make changes.
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
