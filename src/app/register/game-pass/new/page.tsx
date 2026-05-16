import { GamePassFlow } from "@/components/game-pass-flow";
import { TextInput } from "@/components/ui/field";

export default function GamePassNewPage() {
  return (
    <GamePassFlow
      currentSlug="new"
      title="Step 2 · Player Info"
      description="Capture the minimum player identity needed for a single-match game pass purchase after the player chooses the new-player path."
      backHref="/register"
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
