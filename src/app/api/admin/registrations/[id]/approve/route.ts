import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { sendMail } from "@/lib/mail";
import { registrationApprovedEmail } from "@/lib/mail-templates";
import { SeasonReadOnlyError, assertSeasonWritable } from "@/lib/queries/season";

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
    const registration = await db.registration.findUnique({ where: { id } });
    if (!registration) return NextResponse.json({ error: "Registration not found." }, { status: 404 });
    await assertSeasonWritable(registration.seasonId);
    if (registration.status !== "PENDING" && registration.status !== "SUBMITTED") {
      return NextResponse.json({ error: `This registration is already ${registration.status === "REJECTED" ? "denied" : registration.status.toLowerCase()}.` }, { status: 409 });
    }

    const team = teamId ? await db.team.findUnique({ where: { id: teamId } }) : null;
    if (teamId && !team) return NextResponse.json({ error: "Team not found." }, { status: 404 });
    if (team && team.seasonId !== registration.seasonId) {
      return NextResponse.json({ error: "That team isn’t in this registration’s season." }, { status: 400 });
    }

    await db.$transaction(async (tx) => {
      // Guard against a concurrent decision.
      const updated = await tx.registration.updateMany({
        where: { id, status: { in: ["PENDING", "SUBMITTED"] } },
        data: {
          status: "APPROVED",
          approvedAt: new Date(),
          // No team yet: the player goes to the placement queue
          placementState: team ? "ASSIGNED" : registration.placementState === "NONE" ? "NEW" : registration.placementState,
          ...(team ? { divisionId: team.divisionId } : {}),
        },
      });
      if (updated.count !== 1) throw new ConflictError();

      await tx.player.update({ where: { id: registration.playerId }, data: { finalApproval: "APPROVED" } });

      if (team) {
        const requested = parseList(registration.captainRequests);
        const captainRequest =
          requested.includes(team.id) || requested.includes(team.name) || (await tx.captainRequest.count({ where: { registrationId: id, teamId: team.id } })) > 0;
        if (makeCaptain) {
          await tx.captainRequest.updateMany({
            where: { playerId: registration.playerId, teamId: team.id, status: "PENDING" },
            data: { status: "APPROVED", decidedById: session.user.id, decidedAt: new Date() },
          });
        }
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

    const done = await db.registration.findUniqueOrThrow({
      where: { id },
      include: { season: { select: { name: true } }, player: { select: { firstName: true, user: { select: { email: true } } } } },
    });
    await sendMail({
      to: done.player.user.email,
      ...(await registrationApprovedEmail({ firstName: done.player.firstName, seasonName: done.season.name, teamName: team?.name ?? null, captain: !!team && makeCaptain })),
    });
    return NextResponse.json({ success: true, placement: !team });
  } catch (error) {
    if (error instanceof ConflictError) return NextResponse.json({ error: "This registration was already decided." }, { status: 409 });
    if (error instanceof SeasonReadOnlyError) return NextResponse.json({ error: error.message }, { status: 409 });
    console.error("Approve registration failed", error);
    return NextResponse.json({ error: "Couldn’t approve this registration. Try again." }, { status: 500 });
  }
}

class ConflictError extends Error {}
