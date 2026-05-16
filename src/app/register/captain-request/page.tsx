import { RegistrationFlow } from "@/components/registration-flow";
import { FieldLabel, SelectInput, TextArea } from "@/components/ui/field";

export default function RegisterCaptainRequestPage() {
  return (
    <RegistrationFlow
      currentSlug="captain-request"
      title="Step 5 · Captain Request"
      description="Let the player signal captain intent without mixing it into the basic registration path for everyone else."
      backHref="/register/team-preferences"
      nextHref="/register/fees-review"
      aside={<p className="text-sm text-slate-600">In the real app this should likely trigger an approval workflow rather than silently assigning captain access.</p>}
    >
      <div className="space-y-4">
        <FieldLabel label="Request captain review">
          <SelectInput>
            <option>No</option>
            <option>Yes, I want to be reviewed as captain</option>
          </SelectInput>
        </FieldLabel>
        <TextArea className="min-h-32 p-4" defaultValue="I already organize match availability and handle communication for the team." />
      </div>
    </RegistrationFlow>
  );
}
