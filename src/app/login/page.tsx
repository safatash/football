import { PrototypeShell, SectionCard } from "@/components/prototype-shell";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/field";

export default function LoginPage() {
  return (
    <PrototypeShell
      role="player"
      title="Login"
      subtitle="Prototype login entry for returning players and game pass purchasers."
    >
      <SectionCard title="Player login">
        <div className="grid gap-4 md:max-w-xl">
          <TextInput placeholder="Email" defaultValue="maya@example.com" />
          <TextInput placeholder="Password" defaultValue="password" />
          <Button>Login</Button>
        </div>
      </SectionCard>
    </PrototypeShell>
  );
}
