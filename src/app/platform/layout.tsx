import Link from "next/link";
import type { ReactNode } from "react";
import { appName } from "@/lib/branding";
import { requirePlatformAdmin } from "@/platform/guard";
import { PlatformSignOut } from "./controls";

export const metadata = { title: { default: "Platform", template: "%s · Platform" }, robots: { index: false } };

/** The operator area (root domain or admin.<root>): every league, trials, support access. */
export default async function PlatformLayout({ children }: { children: ReactNode }) {
  const me = await requirePlatformAdmin();
  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-4 px-4 py-3">
          <Link href="/platform" className="font-display text-xl font-extrabold">
            {appName()} <span className="text-muted">platform</span>
          </Link>
          <nav aria-label="Platform" className="flex gap-1 text-sm font-bold">
            <Link href="/platform" className="rounded-full px-3 py-1.5 hover:bg-surface-2">
              Leagues
            </Link>
            <Link href="/platform/orgs/new" className="rounded-full px-3 py-1.5 hover:bg-surface-2">
              New league
            </Link>
          </nav>
          <span className="flex-1" />
          <span className="text-[13px] text-muted">{me.email}</span>
          <PlatformSignOut />
        </div>
      </header>
      <main className="mx-auto flex max-w-[1120px] flex-col gap-5 px-4 py-6">{children}</main>
    </div>
  );
}
