import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { playerInOrg, getOrgId } from "@/lib/org";
import { LIMITS, clientIp, hitAll, honeypotFilled, rateKey, tooMany } from "@/platform/rate-limit";

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!domain) return "••••••••";
  return `${local.slice(0, 1)}${"•".repeat(Math.max(local.length - 1, 3))}@${domain}`;
}

/**
 * Look up a returning player by email + date of birth.
 * Responds the same way whichever field doesn't match.
 */
export async function POST(req: NextRequest) {
  try {
    const limited = await hitAll([[rateKey("retrieve-ip", await clientIp(req)), LIMITS.retrieveIp]]);
    if (!limited.ok) return tooMany(limited, "lookups");
    const body = (await req.json().catch(() => ({}))) as { email?: unknown; dob?: unknown };
    // Bots fill the hidden field: answer like a miss
    if (honeypotFilled(body)) return NextResponse.json({ found: false });
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const dob = typeof body.dob === "string" ? body.dob.trim().slice(0, 10) : "";

    if (!email || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      return NextResponse.json({ error: "Enter your email and date of birth." }, { status: 400 });
    }

    const user = await db.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      include: {
        players: {
          ...playerInOrg(await getOrgId()),
          include: {
            teamMemberships: { include: { team: { select: { name: true } } }, orderBy: { joinedAt: "desc" }, take: 1 },
          },
        },
      },
    });

    const player = user?.players[0];
    if (!user || !player || player.dob.toISOString().slice(0, 10) !== dob) {
      return NextResponse.json({ found: false });
    }

    return NextResponse.json({
      found: true,
      firstName: player.firstName,
      lastInitial: player.lastName.slice(0, 1).toUpperCase(),
      maskedEmail: maskEmail(user.email),
      since: player.createdAt.getUTCFullYear(),
      lastTeam: player.teamMemberships[0]?.team.name ?? undefined,
    });
  } catch (error) {
    console.error("Player lookup failed:", error);
    return NextResponse.json({ error: "We couldn’t look that up right now. Please try again in a minute." }, { status: 500 });
  }
}
