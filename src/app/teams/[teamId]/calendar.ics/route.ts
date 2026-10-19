import { NextResponse, type NextRequest } from "next/server";
import { buildCalendar } from "@/lib/ics";
import { getPublicTeam, listPublicMatches } from "@/lib/queries/public";
import { appUrl } from "@/lib/branding";

export const revalidate = 300;

/** A team's games as an .ics file (90-minute events, America/New_York). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const team = await getPublicTeam(teamId);
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });
  const matches = await listPublicMatches(team.seasonId, "all", { teamId: team.id });
  const base = await appUrl();
  const host = new URL(base).hostname;
  const ics = buildCalendar(
    `${team.name} · ${team.season.name}`,
    matches.map((m) => ({
      uid: `match-${m.id}@${host}`,
      start: m.scheduledAt,
      minutes: 90,
      summary: `Game No: ${m.gameNumber} - ${m.homeTeam.name} Vs ${m.awayTeam.name}`,
      location: m.venue
        ? [m.venue.complex, m.venue.name, [m.venue.address, m.venue.city, m.venue.state, m.venue.zip].filter(Boolean).join(" ")].filter(Boolean).join(" - ")
        : (m.field ?? undefined),
      url: `${base}/matches/${m.id}`,
    })),
  );
  const file = `${team.name.replace(/[^A-Za-z0-9]+/g, "-").toLowerCase()}-${team.season.slug}.ics`;
  return new NextResponse(ics, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="${file}"` },
  });
}
