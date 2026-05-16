import { PrototypeShell, SectionCard, StatusBadge } from "@/components/prototype-shell";
import { Button } from "@/components/ui/button";
import { FieldLabel, SelectInput, TextArea } from "@/components/ui/field";
import { registrations } from "@/lib/mock-data";

export default async function RegistrationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const registration = registrations.find((item) => item.id === id) ?? registrations[0];

  return (
    <PrototypeShell
      role="admin"
      title={`Registration ${registration.id}`}
      subtitle="Review, annotate, and assign this player into the season structure."
    >
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <SectionCard title="Player summary">
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-slate-500">Player</p>
              <p className="text-base font-medium">{registration.playerName}</p>
            </div>
            <div>
              <p className="text-slate-500">Email</p>
              <p>{registration.email}</p>
            </div>
            <div>
              <p className="text-slate-500">Preferred team</p>
              <p>{registration.teamPreference}</p>
            </div>
            <div>
              <p className="text-slate-500">Current status</p>
              <div className="mt-1"><StatusBadge label={registration.status} /></div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Actions">
          <div className="space-y-3">
            <Button variant="success" className="w-full">Approve registration</Button>
            <Button variant="warning" className="w-full">Send to review</Button>
            <Button variant="danger" className="w-full">Deny registration</Button>
          </div>
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <SectionCard title="Assignment panel">
          <div className="grid gap-4 md:grid-cols-2">
            <FieldLabel label="Division">
              <SelectInput>
                <option>Women Premier</option>
                <option>Women D2</option>
                <option>Men D1</option>
              </SelectInput>
            </FieldLabel>
            <FieldLabel label="Team">
              <SelectInput>
                <option>{registration.teamPreference}</option>
                <option>Alexandria FC</option>
                <option>Nova Strikers</option>
              </SelectInput>
            </FieldLabel>
          </div>
        </SectionCard>

        <SectionCard title="Notes and payment">
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 p-4">
              <span>Payment status</span>
              <StatusBadge label={registration.paymentStatus} />
            </div>
            <TextArea className="min-h-32 p-4" defaultValue="Captain request pending review. Address verification still needed." />
          </div>
        </SectionCard>
      </div>
    </PrototypeShell>
  );
}
