import { GamePassFlow } from "@/components/game-pass-flow";
import { TextInput } from "@/components/ui/field";

export default function GamePassAccountPage() {
  return (
    <GamePassFlow
      currentSlug="account"
      title="Step 1 · Retrieve player information"
      description="Use existing player details before assigning this purchase to one specific match. This should feel like the returning-player path from standard registration, but without turning the purchase into a season roster registration."
      backHref="/register/game-pass/returning"
      nextHref="/register/game-pass/match-selection"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <TextInput placeholder="First name" defaultValue="Jordan" />
        <TextInput placeholder="Last name" defaultValue="Lee" />
        <TextInput className="md:col-span-2" placeholder="Email" defaultValue="jordan@example.com" />
        <TextInput placeholder="Date of birth" defaultValue="04/12/1998" />
        <TextInput placeholder="Phone" defaultValue="571-555-0191" />
      </div>
    </GamePassFlow>
  );
}
