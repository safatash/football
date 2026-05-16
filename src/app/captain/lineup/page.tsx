import { PrototypeShell, SectionCard } from "@/components/prototype-shell";
import { captainRoster } from "@/lib/mock-data";

export default function CaptainLineupPage() {
  const starters = captainRoster.filter((player) => player.status === "Starter");
  const bench = captainRoster.filter((player) => player.status !== "Starter");

  return (
    <PrototypeShell
      role="captain"
      title="Lineup builder"
      subtitle="Low-fi formation setup for validating the match-day workflow."
    >
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard title="Formation: 4-4-2">
          <div className="grid gap-4 md:grid-cols-2">
            {starters.map((player, index) => (
              <div key={player.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Slot {index + 1}</p>
                <p className="mt-2 font-medium">{player.name}</p>
                <p className="text-sm text-slate-500">#{player.jersey}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Bench and inactive">
          <div className="space-y-3">
            {bench.map((player) => (
              <div key={player.id} className="rounded-2xl border border-slate-200 p-4 text-sm">
                <p className="font-medium">{player.name}</p>
                <p className="text-slate-500">#{player.jersey} · {player.status}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </PrototypeShell>
  );
}
