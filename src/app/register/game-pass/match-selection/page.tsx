import { GamePassFlow } from "@/components/game-pass-flow";
import { FieldLabel, SelectInput } from "@/components/ui/field";

export default function GamePassMatchSelectionPage() {
  return (
    <GamePassFlow
      currentSlug="match-selection"
      title="Step 3 · Match Selection"
      description="Choose the exact match this game pass will apply to. The pass should only work for this one game day."
      backHref="/register/game-pass/new"
      nextHref="/register/game-pass/review"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <FieldLabel label="Target match">
          <SelectInput>
            <option>Game #204 · Fairfax United vs Alexandria FC</option>
            <option>Game #205 · Nova Strikers vs Arlington SC</option>
          </SelectInput>
        </FieldLabel>
        <FieldLabel label="Game pass fee">
          <SelectInput>
            <option>$15 per game</option>
          </SelectInput>
        </FieldLabel>
      </div>
    </GamePassFlow>
  );
}
