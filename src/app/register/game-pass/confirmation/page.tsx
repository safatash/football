import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { GamePassStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { Logo } from "@/components/league";
import { AppBar, Screen } from "@/components/shell/layout";
import { match as matchById } from "@/lib/league-data";
import { PassTicket } from "../ticket";

export const metadata: Metadata = { title: "Game pass confirmed" };

export default async function GamePassConfirmationPage({ searchParams }: { searchParams: Promise<{ match?: string; name?: string }> }) {
  const { match: matchId, name } = await searchParams;
  const m = matchId ? matchById(matchId) : undefined;
  if (!m) notFound();
  const holder = name?.trim().slice(0, 60) || undefined;

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
          <span className="eyebrow !text-ok">Game pass confirmed · Game #{m.id}</span>
          <h1 className="text-[40px]">You’re playing {m.date.split(",")[0] === "Sun" ? "Sunday" : m.date}.</h1>
        </div>
        <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr] lg:items-start">
          <PassTicket match={m} holder={holder} state={<GamePassStatusBadge status="ACTIVE" />} />
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
