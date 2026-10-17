import type Stripe from "stripe";
import prisma from "@/lib/prisma";
import { now } from "@/lib/clock";
import { checkEligibility } from "@/lib/eligibility";
import { passWindow } from "@/lib/game-pass";
import { blocklistHit } from "@/lib/queries/registrations";
import { getSettings } from "@/lib/queries/season";

export class GamePassError extends Error {
  constructor(
    message: string,
    public status: 400 | 403 | 404 | 409 = 400,
  ) {
    super(message);
  }
}

/**
 * Everything that must hold before a player can buy a pass: the match is scheduled and in the
 * future, the player is eligible for its division, their email isn't blocklisted, they aren't
 * suspended or already on either team's season roster, and they don't already have a pass for it.
 */
export async function checkGamePassPurchase(playerId: string, matchId: string, teamId: string | null) {
  const [player, match] = await Promise.all([
    prisma.player.findUnique({
      where: { id: playerId },
      include: { user: { select: { email: true } }, suspensions: { where: { liftedAt: null, startsAt: { lte: now() }, OR: [{ endsAt: null }, { endsAt: { gt: now() } }] } } },
    }),
    prisma.match.findUnique({
      where: { id: matchId },
      include: { division: true, season: true, homeTeam: { select: { id: true, name: true } }, awayTeam: { select: { id: true, name: true } } },
    }),
  ]);
  if (!player) throw new GamePassError("We couldn’t find your player profile.", 404);
  if (!match) throw new GamePassError("That match doesn’t exist.", 404);
  if (match.status !== "SCHEDULED" || match.scheduledAt <= now()) throw new GamePassError(`Game #${match.gameNumber} isn’t open for game passes.`, 409);
  if (!match.season.isActive) throw new GamePassError(`${match.season.name} is closed.`, 409);
  if (teamId && teamId !== match.homeTeamId && teamId !== match.awayTeamId) throw new GamePassError("Pick one of the two teams in this match.");

  if (player.status === "SUSPENDED" || player.suspensions.length) throw new GamePassError("You’re suspended, so you can’t buy a game pass right now.", 403);
  if (await blocklistHit(player.user.email)) throw new GamePassError("This email is not eligible. Contact office@nvasa.org.", 403);
  if (match.division) {
    const elig = checkEligibility(match.division, { dob: player.dob, gender: player.gender }, match.season.startDate);
    if (!elig.ok) throw new GamePassError(`You can’t play in ${match.division.name}: ${elig.reason}.`, 403);
  }
  const onTeam = await prisma.teamRoster.findFirst({
    where: { playerId, leftAt: null, membershipType: "SEASONAL", teamId: { in: [match.homeTeamId, match.awayTeamId] } },
    select: { team: { select: { name: true } } },
  });
  if (onTeam) throw new GamePassError(`You’re already on ${onTeam.team.name}’s roster, so you don’t need a pass.`, 409);
  const existing = await prisma.gamePass.findUnique({ where: { playerId_matchId: { playerId, matchId } } });
  if (existing && existing.status !== "CANCELLED") throw new GamePassError(`You already have a game pass for Game #${match.gameNumber}.`, 409);

  const { gamePassFee } = await getSettings(match.seasonId);
  return { player, match, fee: gamePassFee, existing };
}

/**
 * Records a paid game pass: Payment (GAME_PASS), GamePass (ACTIVE, valid on match day) and, when a
 * team was chosen, a GAME_PASS TeamRoster row for that match only. Idempotent per checkout session.
 */
export async function fulfillGamePass(session: Pick<Stripe.Checkout.Session, "id" | "metadata" | "amount_total" | "currency" | "payment_intent">) {
  const matchId = session.metadata?.matchId;
  const playerId = session.metadata?.playerId;
  const teamId = session.metadata?.teamId || null;
  if (!matchId || !playerId) throw new Error("Game pass checkout is missing matchId/playerId");

  return prisma.$transaction(async (tx) => {
    const paid = await tx.payment.findUnique({ where: { stripeChargeId: session.id }, include: { gamePass: true } });
    if (paid?.gamePass) return paid.gamePass;

    const match = await tx.match.findUniqueOrThrow({ where: { id: matchId }, include: { homeTeam: true, awayTeam: true } });
    const payment =
      paid ??
      (await tx.payment.create({
        data: {
          userId: playerId, // Payment.userId references players.id
          stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
          stripeChargeId: session.id,
          amount: (session.amount_total ?? 0) / 100,
          currency: session.currency ?? "usd",
          status: "PAID",
          paymentType: "GAME_PASS",
          relatedEntityType: "game_pass",
          paidAt: new Date(),
        },
      }));

    const { validFrom, validUntil } = passWindow(match);
    const prior = await tx.gamePass.findUnique({ where: { playerId_matchId: { playerId, matchId } } });
    if (prior && prior.status !== "CANCELLED") {
      // Paid twice for the same match: keep the first pass; the office can refund this payment.
      console.warn(`[game pass] duplicate payment ${payment.id} for pass ${prior.id}`);
      return prior;
    }
    const pass = prior
      ? await tx.gamePass.update({ where: { id: prior.id }, data: { paymentId: payment.id, status: "ACTIVE", validFrom, validUntil, teamId } })
      : await tx.gamePass.create({ data: { playerId, matchId, teamId, paymentId: payment.id, status: "ACTIVE", validFrom, validUntil } });
    await tx.payment.update({ where: { id: payment.id }, data: { relatedEntityId: pass.id } });

    if (teamId) {
      const team = teamId === match.homeTeamId ? match.homeTeam : match.awayTeam;
      await tx.teamRoster.upsert({
        where: { gamePassId: pass.id },
        update: { teamId, divisionId: team.divisionId, leftAt: null },
        create: { playerId, teamId, divisionId: team.divisionId, membershipType: "GAME_PASS", gamePassId: pass.id, matchId, joinedAt: validFrom },
      });
    }
    return pass;
  });
}

/** Marks passes past their window EXPIRED and closes their game-pass roster rows. */
export async function expireGamePasses(at = now(), scope: { playerId?: string } = {}) {
  const due = await prisma.gamePass.findMany({ where: { status: "ACTIVE", validUntil: { lt: at }, ...scope }, select: { id: true, validUntil: true } });
  for (const pass of due) {
    await prisma.$transaction([
      prisma.gamePass.update({ where: { id: pass.id }, data: { status: "EXPIRED" } }),
      prisma.teamRoster.updateMany({ where: { gamePassId: pass.id, membershipType: "GAME_PASS", leftAt: null }, data: { leftAt: pass.validUntil } }),
    ]);
  }
  return due.length;
}
