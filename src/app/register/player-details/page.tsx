import { RegistrationFlow } from "@/components/registration-flow";
import { SelectInput, TextInput } from "@/components/ui/field";

export default function RegisterPlayerDetailsPage() {
  return (
    <RegistrationFlow
      currentSlug="player-details"
      title="Step 2 · Player Details"
      description="Capture the player’s core league identity, age-based eligibility, and playing role."
      backHref="/register/account"
      nextHref="/register/contact"
      aside={<p className="text-sm text-slate-600">This is where the system can start checking division eligibility and guiding the player toward the right league bucket.</p>}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <TextInput defaultValue="06/15/1995" placeholder="Date of birth" />
        <SelectInput defaultValue="Forward">
          <option>Forward</option>
          <option>Midfielder</option>
          <option>Defender</option>
          <option>Goalkeeper</option>
        </SelectInput>
        <SelectInput defaultValue="Women Premier" className="md:col-span-2">
          <option>Women Premier</option>
          <option>Women D2</option>
          <option>Game Pass</option>
        </SelectInput>
      </div>
    </RegistrationFlow>
  );
}
