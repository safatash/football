import { PrototypeShell, SectionCard, StatusBadge } from "@/components/prototype-shell";
import { Button } from "@/components/ui/button";
import { FieldLabel, SelectInput, TextArea } from "@/components/ui/field";
import { placementQueue } from "@/lib/mock-data";

export default async function PlacementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = placementQueue.find((entry) => entry.id === id) ?? placementQueue[0];

  return (
    <PrototypeShell
      role="admin"
      title={item.playerName}
      subtitle="Placement review for a brand-new player who does not yet have a team assignment."
    >
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard title="Player request summary">
          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 p-4">
              <span>Preferred level</span>
              <span className="font-medium">{item.preferredLevel}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 p-4">
              <span>Current status</span>
              <StatusBadge label={item.status} />
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-slate-500">Player notes</p>
              <p className="mt-2">{item.notes}</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Placement action">
          <div className="space-y-4">
            <FieldLabel label="Recommended division">
              <SelectInput>
                <option>Women Premier</option>
                <option>Women D2</option>
                <option>Men D1</option>
                <option>Waitlist</option>
              </SelectInput>
            </FieldLabel>
            <FieldLabel label="Recommended team">
              <SelectInput>
                <option>Fairfax United</option>
                <option>Alexandria FC</option>
                <option>Nova Strikers</option>
                <option>No slot available</option>
              </SelectInput>
            </FieldLabel>
            <TextArea className="min-h-32 p-4" defaultValue="Strong winger profile. Recommend placement on a team that still needs pace up front." />
            <div className="space-y-3">
              <Button variant="success" className="w-full">Assign player</Button>
              <Button variant="warning" className="w-full">Move to waitlist</Button>
              <Button variant="secondary" className="w-full">Request more information</Button>
            </div>
          </div>
        </SectionCard>
      </div>
    </PrototypeShell>
  );
}
