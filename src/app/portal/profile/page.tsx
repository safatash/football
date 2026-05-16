import { PrototypeShell, SectionCard } from "@/components/prototype-shell";
import { TextArea, TextInput } from "@/components/ui/field";

export default function PlayerProfilePage() {
  return (
    <PrototypeShell
      role="player"
      title="Profile"
      subtitle="Player identity, contact details, and preferences."
    >
      <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        This view is for player-maintained profile details. It should not expose captain-only tools such as roster editing or team management.
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Personal details">
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput defaultValue="Maya" />
            <TextInput defaultValue="Johnson" />
            <TextInput className="md:col-span-2" defaultValue="maya@example.com" />
            <TextInput defaultValue="06/15/1995" />
            <TextInput defaultValue="Forward" />
          </div>
        </SectionCard>

        <SectionCard title="Contact and preferences">
          <div className="grid gap-4">
            <TextInput defaultValue="703-555-0182" />
            <TextInput defaultValue="123 Main St, Fairfax, VA" />
            <TextArea className="min-h-32 p-4" defaultValue="Happy to be contacted by captains about lineup and schedule changes." />
          </div>
        </SectionCard>
      </div>
    </PrototypeShell>
  );
}
