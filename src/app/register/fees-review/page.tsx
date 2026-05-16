import { RegistrationFlow } from "@/components/registration-flow";
import { StatusBadge } from "@/components/prototype-shell";

export default function RegisterFeesReviewPage() {
  return (
    <RegistrationFlow
      currentSlug="fees-review"
      title="Step 6 · Fees & Review"
      description="Give the player one clean review step before payment and final submission."
      backHref="/register/captain-request"
      aside={<div className="space-y-2 text-sm text-slate-600"><p>This step should eventually handle coupons, game pass pricing, county-based fees, and payment handoff.</p><p>It is also the best place to catch missing data before submission.</p></div>}
    >
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 p-4 text-sm">
            <p className="text-slate-500">Division fee</p>
            <p className="mt-2 text-2xl font-semibold">$95</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4 text-sm">
            <p className="text-slate-500">Registration status</p>
            <div className="mt-2"><StatusBadge label="Ready to submit" /></div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4 text-sm">
          <p className="font-medium">Review summary</p>
          <ul className="mt-3 space-y-2 text-slate-600">
            <li>Player: Maya Johnson</li>
            <li>Division: Women Premier</li>
            <li>Preferred team: Fairfax United</li>
            <li>Captain request: Yes</li>
          </ul>
        </div>
      </div>
    </RegistrationFlow>
  );
}
