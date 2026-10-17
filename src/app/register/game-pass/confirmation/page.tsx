import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { GamePassStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Icon, type IconName } from "@/components/ui/icon";
import { Logo } from "@/components/league";
import { AppBar, Screen } from "@/components/shell/layout";
import prisma from "@/lib/prisma";
import { now } from "@/lib/clock";
import { TZ, fullName } from "@/lib/format";
import { passStatus } from "@/lib/game-pass";
import { fulfillGamePass } from "@/lib/game-pass-server";
import { matchSelect, toMatchView } from "@/lib/queries/matches";
import { requireUser } from "@/lib/session";
import { stripe } from "@/lib/stripe";
import { PassTicket } from "../ticket";

export const metadata: Metadata = { title: "Game pass confirmed" };

/** The pass for a paid checkout session (fulfilled here too, in case the webhook hasn't arrived yet). */
async function passFromCheckout(sessionId: string, playerId: string) {
  const s = await stripe().checkout.sessions.retrieve(sessionId);
  if (s.metadata?.type !== "game_pass" || s.metadata.playerId !== playerId) return null;
  if (s.payment_status !== "paid") return "unpaid" as const;
  return fulfillGamePass(s);
}

export default async function GamePassConfirmationPage({ searchParams }: { searchParams: Promise<{ session_id?: string; pass?: string }> }) {
  const { session_id, pass: passId } = await searchParams;
  const session = await requireUser("/portal");
  const playerId = session.user.playerId;
  if (!playerId) notFound();

  let id = passId;
  if (session_id) {
    const res = await passFromCheckout(session_id, playerId).catch((e) => {
      console.error("Game pass confirmation failed", e);
      return null;
    });
    if (res === "unpaid") {
      return (
        <>
          <AppBar>
            <Logo />
          </AppBar>
          <Screen>
            <Notice tone="warn" title="We haven’t received your payment yet.">
              If you finished checkout, refresh this page in a minute. Your pass also shows up in your portal once it’s paid.
            </Notice>
          </Screen>
        </>
      );
    }
    id = res?.id;
  }
  if (!id) notFound();
  const pass = await prisma.gamePass.findFirst({
    where: { id, playerId },
    include: { player: { select: { firstName: true, lastName: true } }, team: { select: { name: true } }, match: { select: matchSelect } },
  });
  if (!pass) notFound();
  const m = toMatchView(pass.match);
  const weekday = m.scheduledAt.toLocaleDateString("en-US", { weekday: "long", timeZone: TZ });

  const next: [IconName, ReactNode][] = [
    ["users", <>The captain sees you on the match roster, tagged <b>Game pass</b>.</>],
    ["clock", "Arrive 20 minutes early and check in with the referee."],
    ["wait", <>After the match your pass shows as <b>Expired</b>.</>],
  ];

  return (
    <>
      <AppBar>
        <Logo />
      </AppBar>
      <Screen>
        <div className="flex flex-col gap-1.5">
          <span className="eyebrow !text-ok">Game pass confirmed · Game #{m.gameNumber}</span>
          <h1 className="text-[40px]">You’re playing {weekday}.</h1>
        </div>
        <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr] lg:items-start">
          <PassTicket match={m} holder={fullName(pass.player)} teamName={pass.team?.name} state={<GamePassStatusBadge status={passStatus(pass, now())} />} />
          <div className="flex flex-col gap-3 text-[13.5px]">
            <h2 className="text-[22px]">What happens next</h2>
            {next.map(([icon, text], i) => (
              <div key={i} className="flex items-start gap-2.5">
                <Icon name={icon} className="mt-px size-[18px] shrink-0 text-muted" />
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2.5 lg:flex-row lg:justify-end">
          <ButtonLink href="/portal" variant="primary" block className="lg:w-auto">
            See it in my portal
          </ButtonLink>
          <ButtonLink href="/register/new" variant="ghost" block className="lg:w-auto">
            Join for the whole season instead
          </ButtonLink>
        </div>
      </Screen>
    </>
  );
}
