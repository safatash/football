import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { GamePassError, checkGamePassPurchase, fulfillGamePass } from "@/lib/game-pass-server";
import { getSession } from "@/lib/session";
import { appUrl, getBrand } from "@/lib/branding";
import { OnlinePaymentsUnavailable, createLeagueCheckout } from "@/lib/league-checkout";
import { getOrgId } from "@/lib/db";

const Body = z.object({ matchId: z.string().trim().min(1).max(64), teamId: z.string().trim().max(64).nullish() });

/** Starts a Stripe Checkout for one game pass. Requires a signed-in player. */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Log in or create your profile first." }, { status: 401 });
  const playerId = session.user.playerId;
  if (!playerId) return NextResponse.json({ error: "You need a player profile to buy a game pass." }, { status: 403 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Pick a match to continue." }, { status: 400 });
  const teamId = parsed.data.teamId || null;

  try {
    const { player, match, fee } = await checkGamePassPurchase(playerId, parsed.data.matchId, teamId);
    const metadata = { type: "game_pass", organizationId: await getOrgId(), matchId: match.id, playerId, teamId: teamId ?? "" };

    if (fee <= 0) {
      const pass = await fulfillGamePass({ id: `free_${randomUUID()}`, metadata, amount_total: 0, currency: "usd", payment_intent: null });
      return NextResponse.json({ url: `/register/game-pass/confirmation?pass=${pass.id}` });
    }

    const checkout = await createLeagueCheckout({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: player.user.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: Math.round(fee * 100),
            product_data: {
              name: `${(await getBrand()).name} game pass · Game #${match.gameNumber}`,
              description: `${match.homeTeam.name} vs ${match.awayTeam.name} · this match only`,
            },
          },
        },
      ],
      metadata,
      client_reference_id: `${playerId}:${match.id}`,
      success_url: `${(await appUrl())}/register/game-pass/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${(await appUrl())}/register/game-pass`,
    });
    return NextResponse.json({ url: checkout.url });
  } catch (e) {
    if (e instanceof GamePassError) return NextResponse.json({ error: e.message }, { status: e.status });
    if (e instanceof OnlinePaymentsUnavailable) return NextResponse.json({ error: "Online payments aren’t set up for this league yet, so game passes can’t be bought online. Ask the league office." }, { status: 409 });
    console.error("Game pass checkout failed", e);
    return NextResponse.json({ error: "We couldn’t start checkout. Try again in a moment." }, { status: 500 });
  }
}
