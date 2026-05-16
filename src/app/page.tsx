import Link from "next/link";

const sections = [
  {
    title: "Admin",
    description: "Registration ops, player management, teams, matches, and reporting.",
    links: [
      ["Dashboard", "/admin"],
      ["Registrations", "/admin/registrations"],
      ["Players", "/admin/players"],
      ["Teams", "/admin/teams"],
      ["Matches", "/admin/matches"],
    ],
  },
  {
    title: "Captain",
    description: "Match prep, lineup management, and roster workflows.",
    links: [
      ["Dashboard", "/captain"],
      ["Roster", "/captain/roster"],
      ["Lineup", "/captain/lineup"],
      ["Match Report", "/captain/matches/match-1/report"],
    ],
  },
  {
    title: "Player",
    description: "Registration flow, profile, and season participation history.",
    links: [
      ["Dashboard", "/portal"],
      ["Register", "/register"],
      ["New Player Registration", "/register/playing-background"],
      ["My Registrations", "/portal/registrations"],
      ["Profile", "/portal/profile"],
    ],
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-sky-300">
            NVASA rebuild
          </p>
          <h1 className="mt-4 text-5xl font-semibold tracking-tight text-balance">
            League operations clickable prototype
          </h1>
          <p className="mt-5 text-lg text-slate-300">
            A low-fi coded prototype for admin, captain, and player workflows. Start anywhere below.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {sections.map((section) => (
            <section key={section.title} className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-2xl font-semibold">{section.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">{section.description}</p>
              <div className="mt-6 space-y-3">
                {section.links.map(([label, href]) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                  >
                    <span>{label}</span>
                    <span aria-hidden="true">→</span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
