import type { Metadata } from "next";
import { GamePassFlow, type IdentifyMode } from "./game-pass-flow";

export const metadata: Metadata = { title: "Game pass" };

export default async function GamePassPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams;
  const initial: IdentifyMode = mode === "login" || mode === "find" ? mode : "new";
  return <GamePassFlow initialMode={initial} />;
}
