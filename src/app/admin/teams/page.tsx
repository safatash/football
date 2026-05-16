import { PrototypeShell, SectionCard } from "@/components/prototype-shell";
import { ButtonLink } from "@/components/ui/button";
import { teams } from "@/lib/mock-data";

export default function AdminTeamsPage() {
  return (
    <PrototypeShell
      role="admin"
      title="Teams"
      subtitle="Quick access to team structure, captains, and performance snapshots."
    >
      <div className="grid gap-6 md:grid-cols-2">
        {teams.map((team) => (
          <SectionCard key={team.id} title={team.name}>
            <div className="space-y-4 text-sm">
              <div className="space-y-2">
                <p><span className="text-slate-500">Division:</span> {team.division}</p>
                <p><span className="text-slate-500">Record:</span> {team.record}</p>
                <p><span className="text-slate-500">Captains:</span> {team.captains.join(", ")}</p>
              </div>
              <ButtonLink href={`/admin/teams/${team.id}`} variant="secondary">
                Open team detail
              </ButtonLink>
            </div>
          </SectionCard>
        ))}
      </div>
    </PrototypeShell>
  );
}
