import { RegistrationFlow } from "@/components/registration-flow";
import { FieldLabel, SelectInput } from "@/components/ui/field";

export default function RegisterTeamPreferencesPage() {
  return (
    <RegistrationFlow
      currentSlug="team-preferences"
      title="Step 5 · Team Preferences"
      description="Match the player to the right team context, whether they are returning to an existing team or entering as a brand-new player."
      backHref="/register/playing-background"
      nextHref="/register/captain-request"
      aside={
        <div className="space-y-2 text-sm text-slate-600">
          <p>
            For brand-new players, this step should support placement requests, waitlist logic, and a softer path than the current live-site rule.
          </p>
          <p>
            Returning players can still choose their team directly, but new players may need review before final placement.
          </p>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-emerald-50 p-4 text-sm text-slate-700">
          <p className="font-medium">New player path</p>
          <p className="mt-2">
            If you are new to the league and not yet on a team, you can still register here and request placement.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 p-4 text-sm">
          <p className="text-slate-500">Eligibility rule</p>
          <p className="mt-2 font-medium">Register only if you are already on a team for this season.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FieldLabel label="Preferred team">
            <SelectInput>
              <option>Fairfax United</option>
              <option>Alexandria FC</option>
              <option>Nova Strikers</option>
            </SelectInput>
          </FieldLabel>
          <FieldLabel label="Backup team">
            <SelectInput>
              <option>Alexandria FC</option>
              <option>Fairfax United</option>
              <option>Nova Strikers</option>
            </SelectInput>
          </FieldLabel>
        </div>
      </div>
    </RegistrationFlow>
  );
}
