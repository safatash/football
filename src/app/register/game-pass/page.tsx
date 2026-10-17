import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import { now } from "@/lib/clock";
import { matchSelect, toMatchView } from "@/lib/queries/matches";
import { getActiveSeason, getSettings } from "@/lib/queries/season";
import { getSession } from "@/lib/session";
import { GamePassFlow, type FlowMatch, type IdentifyMode } from "./game-pass-flow";

export const metadata: Metadata = { title: "Game pass" };
export const dynamic = "force-dynamic";

export default async function GamePassPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams;
  const initial: IdentifyMode = mode === "login" || mode === "find" ? mode : "new";
  const [season, session] = await Promise.all([getActiveSeason(), getSession()]);
  const [rows, settings] = season
    ? await Promise.all([
        prisma.match.findMany({
          where: { seasonId: season.id, status: "SCHEDULED", scheduledAt: { gt: now() } },
          select: matchSelect,
          orderBy: [{ scheduledAt: "asc" }, { gameNumber: "asc" }],
        }),
        getSettings(season.id),
      ])
    : [[], { gamePassFee: 15 }];
  const matches: FlowMatch[] = rows.map(toMatchView).map((m) => ({
    id: m.id,
    gameNumber: m.gameNumber,
    date: m.date,
    time: m.time,
    field: m.field,
    division: m.division?.name ?? "",
    homeTeam: { id: m.homeTeam.id, name: m.homeTeam.name, color: m.homeTeam.color, shortName: m.homeTeam.shortName },
    awayTeam: { id: m.awayTeam.id, name: m.awayTeam.name, color: m.awayTeam.color, shortName: m.awayTeam.shortName },
  }));
  const signedIn = session?.user?.playerId ? { name: session.user.name ?? session.user.email ?? "" } : null;
  return <GamePassFlow initialMode={initial} matches={matches} fee={settings.gamePassFee} signedIn={signedIn} />;
}
