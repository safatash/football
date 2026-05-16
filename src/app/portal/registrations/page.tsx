import { PrototypeShell, SectionCard, StatusBadge } from "@/components/prototype-shell";
import { registrations } from "@/lib/mock-data";

export default function PlayerRegistrationsPage() {
  return (
    <PrototypeShell
      role="player"
      title="My registrations"
      subtitle="Track season registration progress and payment state."
    >
      <SectionCard title="Registration history">
        <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Players can track registration and payment status here, but roster management decisions stay with captains and admins.
        </div>
        <div className="space-y-4">
          {registrations.map((registration) => (
            <div key={registration.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-medium">{registration.season}</p>
                <p className="text-sm text-slate-500">Preferred team: {registration.teamPreference}</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge label={registration.paymentStatus} />
                <StatusBadge label={registration.status} />
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </PrototypeShell>
  );
}
