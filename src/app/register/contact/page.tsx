import { RegistrationFlow } from "@/components/registration-flow";
import { TextInput } from "@/components/ui/field";

export default function RegisterContactPage() {
  return (
    <RegistrationFlow
      currentSlug="contact"
      title="Step 3 · Contact"
      description="Collect the contact details the league and captains will rely on during the season."
      backHref="/register/player-details"
      nextHref="/register/playing-background"
      aside={<p className="text-sm text-slate-600">This information feeds league ops, roster contact sheets, and captain communication later on.</p>}
    >
      <div className="grid gap-4">
        <TextInput defaultValue="703-555-0182" placeholder="Phone" />
        <TextInput defaultValue="123 Main St" placeholder="Address" />
        <div className="grid gap-4 md:grid-cols-3">
          <TextInput defaultValue="Fairfax" placeholder="City" />
          <TextInput defaultValue="VA" placeholder="State" />
          <TextInput defaultValue="22030" placeholder="ZIP" />
        </div>
      </div>
    </RegistrationFlow>
  );
}
