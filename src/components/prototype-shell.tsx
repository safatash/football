import Link from "next/link";
import { ReactNode } from "react";
import { seasons } from "@/lib/mock-data";

type Role = "admin" | "captain" | "player";

const navByRole: Record<Role, { href: string; label: string }[]> = {
  admin: [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/registrations", label: "Registrations" },
    { href: "/admin/players", label: "Players" },
    { href: "/admin/teams", label: "Teams" },
    { href: "/admin/matches", label: "Matches" },
    { href: "/admin/standings", label: "Standings" },
    { href: "/admin/divisions/division-1", label: "Division Detail" },
    { href: "/admin/placements", label: "Placement Queue" },
  ],
  captain: [
    { href: "/captain", label: "Dashboard" },
    { href: "/captain/team", label: "Manage Team" },
    { href: "/captain/roster", label: "Roster" },
    { href: "/captain/lineup", label: "Lineup" },
    { href: "/captain/matches/match-1/roster", label: "Match Roster" },
    { href: "/captain/matches/match-1/report", label: "Match Report" },
  ],
  player: [
    { href: "/portal", label: "Dashboard" },
    { href: "/register", label: "Register" },
    { href: "/portal/registrations", label: "My Registrations" },
    { href: "/portal/profile", label: "Profile" },
  ],
};

const roleLinks: { href: string; label: string }[] = [
  { href: "/admin", label: "Admin" },
  { href: "/captain", label: "Captain" },
  { href: "/portal", label: "Player" },
];

const roleDescriptions: Record<Role, string> = {
  admin: "League-wide operations access",
  captain: "Can manage own team and print match rosters",
  player: "Can view personal info and print game roster only",
};

export function PrototypeShell({
  role,
  title,
  subtitle,
  children,
}: {
  role: Role;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">
        <aside className="border-r border-slate-200 bg-white px-6 py-8">
          <Link href="/" className="block text-xl font-semibold tracking-tight">
            NVASA Prototype
          </Link>
          <p className="mt-2 text-sm text-slate-500">League operations prototype</p>

          <div className="mt-8">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Role views
            </p>
            <div className="flex flex-wrap gap-2">
              {roleLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <nav className="mt-8 space-y-2">
            {navByRole[role].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="p-6 lg:p-10">
          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <header className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  {role} view
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
                <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
                <p className="mt-2 text-sm text-slate-600">{roleDescriptions[role]}</p>
              </div>

              <div className="flex items-center gap-3">
                <select className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                  {seasons.map((season) => (
                    <option key={season.id}>{season.name}</option>
                  ))}
                </select>
                <div className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600">
                  Demo mode
                </div>
              </div>
            </header>

            <div className="p-6">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{note}</p>
    </div>
  );
}

export function SectionCard({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <h2 className="text-base font-semibold">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function StatusBadge({ label }: { label: string }) {
  const tone =
    label.toLowerCase().includes("approved") || label.toLowerCase().includes("paid") || label.toLowerCase().includes("completed")
      ? "bg-emerald-100 text-emerald-700"
      : label.toLowerCase().includes("pending") || label.toLowerCase().includes("submitted") || label.toLowerCase().includes("scheduled")
        ? "bg-amber-100 text-amber-700"
        : label.toLowerCase().includes("suspended") || label.toLowerCase().includes("denied")
          ? "bg-rose-100 text-rose-700"
          : "bg-slate-100 text-slate-700";

  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>{label}</span>;
}
