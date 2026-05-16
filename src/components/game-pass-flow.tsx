import Link from "next/link";
import { ReactNode } from "react";
import { PrototypeShell, SectionCard, StatusBadge } from "@/components/prototype-shell";
import { ButtonLink } from "@/components/ui/button";

const steps = [
  { id: 1, slug: "account", title: "Retrieve Info" },
  { id: 2, slug: "new", title: "Player Info" },
  { id: 3, slug: "match-selection", title: "Match Selection" },
  { id: 4, slug: "review", title: "Review & Pay" },
];

export function GamePassFlow({
  currentSlug,
  title,
  description,
  children,
  backHref,
  nextHref,
}: {
  currentSlug: string;
  title: string;
  description?: string;
  children: ReactNode;
  backHref?: string;
  nextHref?: string;
}) {
  const currentIndex = steps.findIndex((step) => step.slug === currentSlug);

  return (
    <PrototypeShell
      role="player"
      title="Game pass purchase"
      subtitle="Single-match flow for players who are not joining the season roster."
    >
      <div className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
        <SectionCard title="Game pass steps">
          <div className="space-y-3">
            {steps.map((step, index) => {
              const state = index < currentIndex ? "complete" : index === currentIndex ? "current" : "upcoming";
              return (
                <Link key={step.slug} href={`/register/game-pass/${step.slug}`} className="block rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{step.id}. {step.title}</span>
                    <StatusBadge label={state} />
                  </div>
                </Link>
              );
            })}
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title={title}>
            <div className="space-y-6">
              {description ? <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm text-slate-700">{description}</div> : null}
              {children}
            </div>
          </SectionCard>

          <SectionCard title="Rules">
            <div className="space-y-2 text-sm text-slate-600">
              <p>Game pass players are valid for one match only.</p>
              <p>The fee is fixed at $15 per match.</p>
              <p>After the match ends, the player should disappear from the roster.</p>
            </div>
          </SectionCard>

          <div className="flex gap-3">
            {backHref ? <ButtonLink href={backHref} variant="secondary">Back</ButtonLink> : null}
            {nextHref ? <ButtonLink href={nextHref}>Continue</ButtonLink> : null}
          </div>
        </div>
      </div>
    </PrototypeShell>
  );
}
