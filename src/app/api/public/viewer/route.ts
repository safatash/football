import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { now } from "@/lib/clock";
import { activeSuspensionWhere } from "@/lib/queries/players";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * What the signed-in viewer may see on public pages for the given teams (`?teams=a,b`): their
 * role on each team, and which of those teams' players are suspended. Signed-out viewers get
 * nothing beyond `signedIn: false`, so cached public HTML never carries private details.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  const headers = { "Cache-Control": "private, no-store" };
  if (!session?.user) return NextResponse.json({ signedIn: false, isAdmin: false, roles: {}, suspended: [] }, { headers });

  const teamIds = (req.nextUrl.searchParams.get("teams") ?? "").split(",").map((t) => t.trim()).filter(Boolean).slice(0, 4);
  const [memberships, suspended] = await Promise.all([
    session.user.playerId
      ? db.teamRoster.findMany({
          where: { playerId: session.user.playerId, teamId: { in: teamIds }, leftAt: null },
          select: { teamId: true, isCaptain: true, membershipType: true },
        })
      : [],
    db.teamRoster.findMany({
      where: { teamId: { in: teamIds }, leftAt: null, membershipType: "SEASONAL", player: { OR: [{ status: "SUSPENDED" }, { suspensions: { some: activeSuspensionWhere(now()) } }] } },
      select: { playerId: true },
    }),
  ]);
  const roles: Record<string, "captain" | "player"> = {};
  for (const m of memberships) roles[m.teamId] = m.isCaptain && m.membershipType === "SEASONAL" ? "captain" : (roles[m.teamId] ?? "player");
  return NextResponse.json({ signedIn: true, isAdmin: !!session.user.isAdmin, roles, suspended: [...new Set(suspended.map((s) => s.playerId))] }, { headers });
}
