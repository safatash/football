import { GamePassFlow } from "@/components/game-pass-flow";
import { StatusBadge } from "@/components/prototype-shell";

export default function GamePassReviewPage() {
  return (
    <GamePassFlow
      currentSlug="review"
      title="Step 4 · Review & Pay"
      description="Confirm the single-match purchase details before checkout."
      backHref="/register/game-pass/match-selection"
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 p-4 text-sm">
          <p className="font-medium">Purchase summary</p>
          <ul className="mt-3 space-y-2 text-slate-600">
            <li>Player: Jordan Lee</li>
            <li>Match: Game #204 · Fairfax United vs Alexandria FC</li>
            <li>Fee: $15</li>
            <li>Roster scope: This match only</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4 text-sm">
          <p className="text-slate-500">Status</p>
          <div className="mt-2"><StatusBadge label="Ready for payment" /></div>
        </div>
      </div>
    </GamePassFlow>
  );
}
