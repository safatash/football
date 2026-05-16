import Link from "next/link";
import { ReactNode } from "react";
import { PrototypeShell, SectionCard, StatusBadge } from "@/components/prototype-shell";
import { ButtonLink } from "@/components/ui/button";
import { registrationSteps } from "@/lib/mock-data";

export function RegistrationFlow({
  currentSlug,
  title,
  description,
  children,
  backHref,
  nextHref,
  aside,
}: {
  currentSlug: string;
  title: string;
  description?: string;
  children: ReactNode;
  backHref?: string;
  nextHref?: string;
  aside?: ReactNode;
}) {
  const currentIndex = registrationSteps.findIndex((step) => step.slug === currentSlug);

  return (
    <PrototypeShell
      role="player"
      title="Registration wizard"
      subtitle="Route-based prototype for the seasonal registration flow."
    >
      <div className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
        <SectionCard title="Steps">
          <div className="space-y-3">
            {registrationSteps.map((step, index) => {
              const state = index < currentIndex ? "complete" : index === currentIndex ? "current" : "upcoming";
              return (
                <Link key={step.slug} href={`/register/${step.slug}`} className="block rounded-2xl border border-slate-200 p-4">
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
              {description ? (
                <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm text-slate-700">
                  {description}
                </div>
              ) : null}
              {children}
            </div>
          </SectionCard>

          {aside ? <SectionCard title="Helpful context">{aside}</SectionCard> : null}

          <div className="flex gap-3">
            {backHref ? <ButtonLink href={backHref} variant="secondary">Back</ButtonLink> : null}
            {nextHref ? <ButtonLink href={nextHref}>Continue</ButtonLink> : null}
          </div>
        </div>
      </div>
    </PrototypeShell>
  );
}
