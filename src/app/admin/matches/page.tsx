import { PrototypeShell, SectionCard, StatusBadge } from "@/components/prototype-shell";
import { ButtonLink } from "@/components/ui/button";
import { matches } from "@/lib/mock-data";

export default function AdminMatchesPage() {
  return (
    <PrototypeShell
      role="admin"
      title="Matches"
      subtitle="Manage upcoming fixtures and jump into report editing."
    >
      <SectionCard title="Fixture list">
        <div className="space-y-4">
          {matches.map((match) => (
            <div key={match.id} className="flex flex-col gap-4 rounded-2xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-medium">Game #{match.gameNumber} · {match.home} vs {match.away}</p>
                <p className="text-sm text-slate-500">{match.startsAt} · {match.field}</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge label={match.status} />
                <div className="flex items-center gap-2">
                  <ButtonLink href={`/admin/matches/${match.id}`} variant="secondary" className="rounded-xl px-4 py-2">
                    Details
                  </ButtonLink>
                  <ButtonLink href={`/captain/matches/${match.id}/report`} className="rounded-xl px-4 py-2">
                    Open report
                  </ButtonLink>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </PrototypeShell>
  );
}
