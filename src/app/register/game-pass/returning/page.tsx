import { PrototypeShell, SectionCard } from "@/components/prototype-shell";
import { ButtonLink } from "@/components/ui/button";

export default function GamePassReturningPage() {
  return (
    <PrototypeShell
      role="player"
      title="Game pass · Returning player"
      subtitle="Returning players should be able to log in or retrieve their details before buying a single-match pass."
    >
      <SectionCard title="Returning player options">
        <div className="grid gap-3 text-sm">
          <ButtonLink href="/login" variant="secondary">Login</ButtonLink>
          <ButtonLink href="/register/game-pass/account" variant="secondary">Retrieve player information</ButtonLink>
          <ButtonLink href="/register/game-pass/new">Continue as new player instead</ButtonLink>
          <div className="rounded-2xl border border-slate-200 bg-amber-50 p-4 text-slate-700">
            This purchase should only grant roster access for one specific match, at a fixed fee of $15, and should not create a permanent season-roster record.
          </div>
        </div>
      </SectionCard>
    </PrototypeShell>
  );
}
