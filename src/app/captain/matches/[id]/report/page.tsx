import { PrototypeShell, SectionCard, StatusBadge } from "@/components/prototype-shell";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/field";
import { captainRoster, matches } from "@/lib/mock-data";

export default async function CaptainMatchReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const match = matches.find((item) => item.id === id) ?? matches[0];

  return (
    <PrototypeShell
      role="captain"
      title={`Match report · Game #${match.gameNumber}`}
      subtitle="Track score, player stats, and final validation before submission."
    >
      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <SectionCard title="Player stats">
          <div className="space-y-4">
            {captainRoster.map((player) => (
              <div key={player.id} className="grid gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-[1.5fr_repeat(4,90px)] md:items-center">
                <div>
                  <p className="font-medium">{player.name}</p>
                  <p className="text-sm text-slate-500">#{player.jersey}</p>
                </div>
                <TextInput defaultValue="0" aria-label="Goals" />
                <TextInput defaultValue="0" aria-label="Assists" />
                <TextInput defaultValue="0" aria-label="Yellow cards" />
                <TextInput defaultValue="0" aria-label="Red cards" />
              </div>
            ))}
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Match summary">
            <div className="space-y-3 text-sm">
              <p className="font-medium">{match.home} vs {match.away}</p>
              <p className="text-slate-500">{match.startsAt}</p>
              <p className="text-slate-500">{match.field}</p>
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 p-3">
                <span>Status</span>
                <StatusBadge label={match.status} />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Validation">
            <div className="space-y-3 text-sm">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
                Goal totals do not match the entered final score yet.
              </div>
              <Button className="w-full">Save draft</Button>
              <Button variant="success" className="w-full">Submit final report</Button>
            </div>
          </SectionCard>
        </div>
      </div>
    </PrototypeShell>
  );
}
