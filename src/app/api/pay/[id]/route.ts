import { NextRequest, NextResponse } from "next/server";
import { loadPayLink } from "@/lib/pay-link";
import { appUrl, getBrand } from "@/lib/branding";
import { OnlinePaymentsUnavailable, createLeagueCheckout } from "@/lib/league-checkout";

/** Opens Stripe Checkout for a payment link's current balance. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sig = String((await req.formData()).get("sig") ?? "");
  const back = `${(await appUrl())}/pay/${id}?sig=${encodeURIComponent(sig)}`;
  const link = await loadPayLink(id, sig);
  if (!link) return NextResponse.redirect(back, 303);
  if (link.summary.balance <= 0) return NextResponse.redirect(back, 303);
  try {
    const { reg, summary } = link;
    const session = await createLeagueCheckout({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: `${(await getBrand()).name} ${reg.season.name}${reg.division ? ` · ${reg.division.name}` : ""}`, description: `Balance for ${reg.player.firstName} ${reg.player.lastName}` },
            unit_amount: Math.round(summary.balance * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${back}&paid=1`,
      cancel_url: back,
      client_reference_id: reg.id,
      customer_email: reg.player.user.email,
      metadata: { type: "registration_balance", registrationId: reg.id, playerId: reg.playerId },
    });
    return NextResponse.redirect(session.url!, 303);
  } catch (err) {
    if (err instanceof OnlinePaymentsUnavailable) return NextResponse.redirect(`${back}&error=unavailable`, 303);
    console.error("Payment link checkout failed:", err instanceof Error ? err.message : err);
    return NextResponse.redirect(`${back}&error=1`, 303);
  }
}
