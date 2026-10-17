import { notFound } from "next/navigation";
import { FFX_ROSTER, match, team } from "@/lib/league-data";
import { ReportClient, type ReportDraft } from "./report-client";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Match report · Game #${id}` };
}

/** Players who played Game #203 (sample data). */
const PLAYED = [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 16, 17, 21, 23];

const SAVED_DRAFTS: Record<number, Omit<ReportDraft, "home" | "away">> = {
  203: { stats: { 9: { g: 1, a: 0 }, 17: { g: 0, a: 1 }, 10: { g: 0, a: 1 } }, cards: { 5: "y", 21: "r" } },
};

export default async function CaptainMatchReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = match(id);
  if (!m || (m.home !== "ffx" && m.away !== "ffx")) notFound();
  const draft = SAVED_DRAFTS[m.id] ?? { stats: {}, cards: {} };
  return (
    <ReportClient
      matchId={m.id}
      meta={`${m.date.replace(/^\w+, /, "")} · ${m.field}`}
      home={{ id: m.home, name: team(m.home).name }}
      away={{ id: m.away, name: team(m.away).name }}
      ourSide={m.home === "ffx" ? "home" : "away"}
      players={FFX_ROSTER.filter((p) => PLAYED.includes(p.jersey)).map((p) => ({ jersey: p.jersey, name: p.name }))}
      initial={{ home: m.score?.[0] ?? 0, away: m.score?.[1] ?? 0, ...draft }}
      submitted={m.report === "Submitted"}
    />
  );
}
