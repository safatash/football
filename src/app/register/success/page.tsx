import type { Metadata } from "next";
import { PaymentBadge, RegistrationBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Logo } from "@/components/league";
import { AppBar, Screen } from "@/components/shell/layout";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";

export const metadata: Metadata = { title: "Registration received" };

type Info = {
  firstName?: string;
  email?: string;
  paid: boolean;
  submittedAt?: Date;
  preferredTeam?: string;
  captainRequest: boolean;
};

async function loadInfo(sessionId?: string, registrationId?: string): Promise<Info> {
  const fallback: Info = { paid: true, captainRequest: false };
  try {
    let regId = registrationId;
    let stripePaid = false;
    if (sessionId && process.env.STRIPE_SECRET_KEY) {
      const s = await stripe().checkout.sessions.retrieve(sessionId);
      regId = s.metadata?.registrationId ?? s.client_reference_id ?? undefined;
      stripePaid = s.payment_status === "paid";
    }
    if (!regId) return fallback;
    const reg = await db.registration.findUnique({
      where: { id: regId },
      include: {
        player: { include: { user: { select: { email: true } } } },
        preferredTeam: { select: { name: true } },
        _count: { select: { captainRequestRows: true } },
      },
    });
    if (!reg) return fallback;
    let teams: string[] = [];
    try {
      teams = JSON.parse(reg.selectedTeams) as string[];
    } catch {
      teams = [];
    }
    return {
      firstName: reg.player.firstName,
      email: reg.player.user.email,
      paid: stripePaid || reg.paymentStatus === "PAID",
      submittedAt: reg.submittedAt,
      preferredTeam: reg.preferredTeam?.name ?? teams[0],
      captainRequest: reg._count.captainRequestRows > 0 || Boolean(reg.captainRequests),
    };
  } catch (error) {
    console.error("Could not load registration for success page:", error);
    return fallback;
  }
}

export default async function RegistrationSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string; registration?: string }>;
}) {
  const { session_id, registration } = await searchParams;
  const info = await loadInfo(session_id, registration);

  const submitted = info.submittedAt
    ? info.submittedAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })
    : "Just now";

  const timeline: [string, string, "done" | "cur" | "next"][] = [
    ["Submitted", submitted, "done"],
    ["League office review", "Usually 2–3 days", "cur"],
    [info.preferredTeam ? `Added to ${info.preferredTeam}` : "Placed on a team", "After approval", "next"],
  ];

  return (
    <>
      <AppBar>
        <Logo />
      </AppBar>
      <Screen>
        <div className="flex flex-col items-start gap-4 pt-2.5">
          <span className="grid size-16 place-items-center rounded-full bg-lime text-lime-ink">
            <Icon name="check" className="size-[34px] stroke-[3]" />
          </span>
          <h1 className="text-[40px]">You’re in the queue{info.firstName ? `, ${info.firstName}` : ""}.</h1>
          <p className="text-muted">
            Your Spring 2026 registration is {info.paid ? "paid and " : ""}waiting for the league office.{" "}
            {info.email ? (
              <>
                We’ll email <b className="text-fg">{info.email}</b> when it’s approved.
              </>
            ) : (
              "We’ll email you when it’s approved."
            )}
          </p>
        </div>

        <Card className="flex flex-col gap-3.5">
          <div className="flex items-center justify-between gap-3">
            <b>Registration</b>
            <RegistrationBadge status="Pending Review" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <b>Payment</b>
            <PaymentBadge status={info.paid ? "PAID" : "PENDING"} />
          </div>
          <hr className="border-line" />
          <ol className="flex flex-col gap-3.5" aria-label="What happens next">
            {timeline.map(([title, sub, state]) => (
              <li key={title} className="flex items-center gap-3" aria-current={state === "cur" ? "step" : undefined}>
                <span
                  className={`grid size-[22px] shrink-0 place-items-center rounded-full ${
                    state === "done"
                      ? "bg-ok text-white"
                      : state === "cur"
                        ? "bg-warn-bg text-warn shadow-[inset_0_0_0_2px_var(--warn)]"
                        : "bg-surface-2 text-faint"
                  }`}
                >
                  {state === "done" ? <Icon name="check" className="size-[13px] stroke-[3]" /> : null}
                </span>
                <div className="flex-1">
                  <b className="text-[13.5px]">{title}</b>
                  <div className="text-xs text-muted">{sub}</div>
                </div>
              </li>
            ))}
          </ol>
          {info.captainRequest ? (
            <Notice tone="warn" icon="star">
              Your captain request is included in the review.
            </Notice>
          ) : null}
        </Card>

        <div className="flex flex-col gap-2.5 lg:flex-row lg:justify-end">
          <ButtonLink href="/portal" variant="primary" block className="lg:w-auto">
            Go to my portal
          </ButtonLink>
          <ButtonLink href="/" variant="ghost" block className="lg:w-auto">
            Back to NVASA home
          </ButtonLink>
        </div>
      </Screen>
    </>
  );
}
