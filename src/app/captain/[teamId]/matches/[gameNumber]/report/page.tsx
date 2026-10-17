import { notFound } from "next/navigation";
import { TZ, fmtShort, fullName } from "@/lib/format";
import { matchRosterPlayers, teamAccess, teamMatch, teamReport } from "@/lib/queries/captain";
import { REPORT_GRACE_MS } from "@/lib/queries/matches";
import { teamRoster } from "@/lib/queries/teams";
import { ReportClient, type ReportDraft } from "./report-client";

export async function generateMetadata({ params }: { params: Promise<{ gameNumber: string }> }) {
  const { gameNumber } = await params;
  return { title: `Match report · Game #${gameNumber}` };
}

export default async function CaptainMatchReportPage({ params }: { params: Promise<{ teamId: string; gameNumber: string }> }) {
  const { teamId, gameNumber } = await params;
  const { team, access } = await teamAccess(teamId);
  if (!team || !access) notFound();
  const m = await teamMatch(team.id, team.seasonId, gameNumber);
  if (!m) notFound();

  const [report, played, season] = await Promise.all([teamReport(m.id, team.id), matchRosterPlayers(m.id, team.id), teamRoster(team.id)]);

  // Players who were on the match roster (or the season roster if there wasn't one), plus anyone with stats.
  const jerseyOf = new Map(season.map((p) => [p.player.id, p.jerseyNumber]));
  const players = played
    ? played.players.map((p) => ({ id: p.playerId, jersey: p.jersey, name: p.name }))
    : season.map((p) => ({ id: p.player.id, jersey: p.jerseyNumber, name: p.name }));
  for (const s of report?.stats ?? []) {
    if (!players.some((p) => p.id === s.playerId)) players.push({ id: s.playerId, jersey: jerseyOf.get(s.playerId) ?? null, name: fullName(s.player) });
  }
  players.sort((a, b) => (a.jersey ?? 999) - (b.jersey ?? 999) || a.name.localeCompare(b.name));

  const initial: ReportDraft = {
    home: report?.homeScore ?? m.homeScore ?? 0,
    away: report?.awayScore ?? m.awayScore ?? 0,
    stats: Object.fromEntries((report?.stats ?? []).map((s) => [s.playerId, { g: s.goals, a: s.assists }])),
    cards: Object.fromEntries((report?.stats ?? []).filter((s) => s.red || s.yellow).map((s) => [s.playerId, s.red ? "r" : "y"])),
    redNote: report?.redCardNote ?? "",
  };
  const submitted = report?.status === "SUBMITTED" || report?.status === "CONFIRMED";
  const due = new Date(m.scheduledAt.getTime() + REPORT_GRACE_MS).toLocaleDateString("en-US", { weekday: "short", timeZone: TZ });

  return (
    <ReportClient
      matchId={m.gameNumber}
      meta={`${fmtShort(m.scheduledAt)}${m.field ? ` · ${m.field}` : ""}`}
      home={m.homeTeam}
      away={m.awayTeam}
      ourSide={m.homeTeam.id === team.id ? "home" : "away"}
      players={players}
      initial={initial}
      submitted={submitted}
      submittedLabel={report?.status === "CONFIRMED" ? "Confirmed" : "Submitted"}
      due={due}
      backHref={`/captain/${team.id}`}
      canEdit={access !== "player"}
    />
  );
}
