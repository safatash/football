import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/session";

const Body = z.object({
  teamId: z
    .string()
    .trim()
    .max(64)
    .nullish()
    .transform((v) => v || null),
  makeCaptain: z.boolean().optional().default(false),
});

function parseList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (Array.isArray(v)) return v.map(String);
  } catch {
    /* legacy comma list */
  }
  return raw.split(",").map((x) => x.trim()).filter(Boolean);
}

/** Approve a registration. With a team: adds a seasonal roster row. Without: leaves the player for placement. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  if (!session.user.isAdmin) return NextResponse.json({ error: "Only the league office can approve registrations." }, { status: 403 });

  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request.", issues: parsed.error.flatten() }, { status: 400 });
  const { teamId, makeCaptain } = parsed.data;

  try {
    const registration = await prisma.registration.findUnique({ where: { id } });
    if (!registration) return NextResponse.json({ error: "Registration not found." }, { status: 404 });
    if (registration.status !== "PENDING" && registration.status !== "SUBMITTED") {
      return NextResponse.json({ error: `This registration is already ${registration.status === "REJECTED" ? "denied" : registration.status.toLowerCase()}.` }, { status: 409 });
    }

    const team = teamId ? await prisma.team.findUnique({ where: { id: teamId } }) : null;
    if (teamId && !team) return NextResponse.json({ error: "Team not found." }, { status: 404 });
    if (team && team.seasonId !== registration.seasonId) {
      return NextResponse.json({ error: "That team isn’t in this registration’s season." }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      // Guard against a concurrent decision.
      const updated = await tx.registration.updateMany({
        where: { id, status: { in: ["PENDING", "SUBMITTED"] } },
        data: { status: "APPROVED", approvedAt: new Date() },
      });
      if (updated.count !== 1) throw new ConflictError();

      await tx.player.update({ where: { id: registration.playerId }, data: { finalApproval: "APPROVED" } });

      if (team) {
        const requested = parseList(registration.captainRequests);
        const captainRequest = requested.includes(team.id) || requested.includes(team.name);
        const existing = await tx.teamRoster.findFirst({
          where: { playerId: registration.playerId, teamId: team.id, membershipType: "SEASONAL", matchId: null },
        });
        if (existing) {
          await tx.teamRoster.update({
            where: { id: existing.id },
            data: { leftAt: null, isCaptain: makeCaptain, captainRequest },
          });
        } else {
          await tx.teamRoster.create({
            data: {
              playerId: registration.playerId,
              teamId: team.id,
              divisionId: team.divisionId,
              membershipType: "SEASONAL",
              isCaptain: makeCaptain,
              captainRequest,
            },
          });
        }
      }
    });

    return NextResponse.json({ success: true, placement: !team });
  } catch (error) {
    if (error instanceof ConflictError) return NextResponse.json({ error: "This registration was already decided." }, { status: 409 });
    console.error("Approve registration failed", error);
    return NextResponse.json({ error: "Couldn’t approve this registration. Try again." }, { status: 500 });
  }
}

class ConflictError extends Error {}
