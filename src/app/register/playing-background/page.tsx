import { RegistrationFlow } from "@/components/registration-flow";
import { FieldLabel, SelectInput, TextArea } from "@/components/ui/field";

export default function RegisterPlayingBackgroundPage() {
  return (
    <RegistrationFlow
      currentSlug="playing-background"
      title="Step 4 · Playing Background"
      description="This step helps the league place brand-new players more intelligently, instead of forcing them into a team-first path too early."
      backHref="/register/contact"
      nextHref="/register/team-preferences"
      aside={<div className="space-y-2 text-sm text-slate-600"><p>Useful for skill-based placement, division fit, and letting admins review new-player requests before assigning a team.</p><p>This is probably one of the biggest differences between a returning-player flow and a true new-player flow.</p></div>}
    >
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <FieldLabel label="Have you played in this league before?">
            <SelectInput>
              <option>No, I’m new</option>
              <option>Yes, returning player</option>
            </SelectInput>
          </FieldLabel>
          <FieldLabel label="Preferred competition level">
            <SelectInput>
              <option>Not sure, help place me</option>
              <option>Beginner / social</option>
              <option>Intermediate</option>
              <option>Competitive</option>
            </SelectInput>
          </FieldLabel>
        </div>
        <TextArea
          className="min-h-32 p-4"
          defaultValue="I usually play winger or striker and I’m looking for a team that trains casually but plays competitive weekend matches."
        />
      </div>
    </RegistrationFlow>
  );
}
