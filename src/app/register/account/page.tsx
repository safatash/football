import { RegistrationFlow } from "@/components/registration-flow";
import { TextInput } from "@/components/ui/field";

export default function RegisterAccountPage() {
  return (
    <RegistrationFlow
      currentSlug="account"
      title="Step 1 · Account"
      description="Start with the account details the player will use to sign in and manage their registration later."
      nextHref="/register/player-details"
      aside={<p className="text-sm text-slate-600">This step is simple on purpose. We just need enough to create the account before asking league-specific questions.</p>}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <TextInput placeholder="First name" defaultValue="Maya" />
        <TextInput placeholder="Last name" defaultValue="Johnson" />
        <TextInput className="md:col-span-2" placeholder="Email" defaultValue="maya@example.com" />
        <TextInput placeholder="Password" defaultValue="password" />
        <TextInput placeholder="Confirm password" defaultValue="password" />
      </div>
    </RegistrationFlow>
  );
}
