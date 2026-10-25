/**
 * Stripe webhooks beyond a completed checkout, through the real route handler with unsigned test
 * events: refunds made in Stripe land in the ledger (once, even when Stripe retries), a fully
 * refunded game pass is cancelled, and an expired registration checkout releases the spot.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auth, hasDb } from "./setup";

describe.skipIf(!hasDb)("Stripe refunds and expired checkouts (database)", async () => {
  const { NextRequest } = await import("next/server");
  const { POST } = await import("@/app/api/stripe/webhook/route");
  const { fulfillGamePass } = await import("@/lib/game-pass-server");
  // NVASA's rows through the owner's league-scoped client
  const prisma = (await import("@/platform/db")).clientForOrg("org_nvasa");

  const ids = {} as Record<"player" | "season" | "division" | "team" | "m208" | "regPaid" | "payment" | "regOpen" | "regExpired" | "pass", string>;
  let n = 0;
  const send = async (type: string, object: Record<string, unknown>) => {
    // Unsigned test events (allowed outside production). Cleared on every send: Prisma loads a
    // local .env the first time a client connects, which can bring the secret back.
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const res = await POST(new NextRequest("http://localhost/api/stripe/webhook", { method: "POST", body: JSON.stringify({ id: `evt_itest_${++n}`, type, data: { object } }) }));
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };
  const ledger = (registrationId: string) => prisma.payment.findMany({ where: { relatedEntityType: "registration", relatedEntityId: registrationId }, orderBy: { createdAt: "asc" } });

  async function cleanup() {
    // Game passes first: their payments are referenced by the pass
    if (ids.m208) {
      const passes = await prisma.gamePass.findMany({ where: { playerId: ids.player, matchId: ids.m208 }, select: { id: true, paymentId: true } });
      await prisma.teamRoster.deleteMany({ where: { gamePassId: { in: passes.map((p) => p.id) } } });
      await prisma.gamePass.deleteMany({ where: { id: { in: passes.map((p) => p.id) } } });
      await prisma.payment.deleteMany({ where: { OR: [{ id: { in: passes.map((p) => p.paymentId) } }, { relatedEntityType: "game_pass", relatedEntityId: { in: passes.map((p) => p.id) } }] } });
    }
    const regs = await prisma.registration.findMany({ where: { playerNote: "itest-stripe-events" }, select: { id: true } });
    const regIds = regs.map((r) => r.id);
    await prisma.captainRequest.deleteMany({ where: { registrationId: { in: regIds } } });
    await prisma.registration.deleteMany({ where: { id: { in: regIds } } });
    await prisma.payment.deleteMany({ where: { OR: [{ relatedEntityType: "registration", relatedEntityId: { in: regIds } }, { stripeChargeId: { startsWith: "ch_itest" } }, { stripeChargeId: "cs_itest_refund" }] } });
  }

  beforeAll(async () => {
    auth.user = null;
    const season = await prisma.season.findFirstOrThrow({ where: { isActive: true } });
    const match = await prisma.match.findUniqueOrThrow({ where: { seasonId_gameNumber: { seasonId: season.id, gameNumber: 208 } } });
    const player = await prisma.player.findFirstOrThrow({ where: { user: { email: "hannah.cole@example.com" } } });
    const team = await prisma.team.findFirstOrThrow({ where: { seasonId: season.id } });
    Object.assign(ids, { player: player.id, season: season.id, division: team.divisionId, team: team.id, m208: match.id });
    await cleanup();

    // A paid $100 registration, as the checkout webhook records it
    const reg = await prisma.registration.create({
      data: { playerId: ids.player, seasonId: ids.season, divisionId: ids.division, totalAmount: 100, status: "PENDING", paymentStatus: "PAID", playerNote: "itest-stripe-events" },
    });
    const payment = await prisma.payment.create({
      data: { userId: ids.player, stripePaymentIntentId: "pi_itest_refund", stripeChargeId: "cs_itest_refund", amount: 100, status: "PAID", paymentType: "REGISTRATION_FEE", relatedEntityType: "registration", relatedEntityId: reg.id, method: "STRIPE", paidAt: new Date() },
    });
    await prisma.registration.update({ where: { id: reg.id }, data: { paymentId: payment.id } });
    ids.regPaid = reg.id;
    ids.payment = payment.id;
  });
  afterAll(cleanup);

  it("records a partial refund once, even when Stripe sends the event again", async () => {
    const charge = { id: "ch_itest_1", object: "charge", payment_intent: "pi_itest_refund", amount_refunded: 3000, currency: "usd" };
    expect(await send("charge.refunded", charge)).toMatchObject({ status: 200, body: { recorded: 30 } });
    expect(await send("charge.refunded", charge)).toMatchObject({ status: 200, body: { recorded: 0 } });
    const rows = await ledger(ids.regPaid);
    expect(rows.filter((r) => r.paymentType === "REFUND").map((r) => [Number(r.amount), r.status, r.method, r.reference])).toEqual([[30, "REFUNDED", "STRIPE", "ch_itest_1"]]);
    expect((await prisma.registration.findUniqueOrThrow({ where: { id: ids.regPaid } })).paymentStatus).toBe("PARTIAL");
  });

  it("adds only the new part of a later refund; fully refunded marks the registration refunded", async () => {
    // Stripe reports the cumulative amount refunded on the charge
    expect(await send("charge.refunded", { id: "ch_itest_1", object: "charge", payment_intent: "pi_itest_refund", amount_refunded: 10000, currency: "usd" })).toMatchObject({ body: { recorded: 70 } });
    const refunds = (await ledger(ids.regPaid)).filter((r) => r.paymentType === "REFUND");
    expect(refunds.map((r) => Number(r.amount))).toEqual([30, 70]);
    expect((await prisma.registration.findUniqueOrThrow({ where: { id: ids.regPaid } })).paymentStatus).toBe("REFUNDED");
    expect(await prisma.auditLog.count({ where: { action: "payment.stripe_refund", entityId: ids.regPaid } })).toBe(2);
  });

  it("ignores refunds for payments that aren't ours", async () => {
    expect(await send("charge.refunded", { id: "ch_itest_other", object: "charge", payment_intent: "pi_not_ours", amount_refunded: 500, currency: "usd" })).toMatchObject({
      status: 200,
      body: { ignored: "unknown payment" },
    });
  });

  it("cancels a fully refunded game pass and takes it off the match roster", async () => {
    const match = await prisma.match.findUniqueOrThrow({ where: { id: ids.m208 } });
    const pass = await fulfillGamePass({ id: "ch_itest_gp_session", metadata: { type: "game_pass", matchId: ids.m208, playerId: ids.player, teamId: match.awayTeamId }, amount_total: 1500, currency: "usd", payment_intent: "pi_itest_gp" });
    expect(await prisma.teamRoster.count({ where: { gamePassId: pass.id, leftAt: null } })).toBe(1);
    expect(await send("charge.refunded", { id: "ch_itest_gp", object: "charge", payment_intent: "pi_itest_gp", amount_refunded: 1500, currency: "usd" })).toMatchObject({ body: { recorded: 15 } });
    expect((await prisma.gamePass.findUniqueOrThrow({ where: { id: pass.id } })).status).toBe("CANCELLED");
    expect(await prisma.teamRoster.count({ where: { gamePassId: pass.id, leftAt: null } })).toBe(0);
    expect(await prisma.payment.count({ where: { paymentType: "REFUND", relatedEntityType: "game_pass", relatedEntityId: pass.id } })).toBe(1);
  });

  it("an expired registration checkout cancels the unpaid registration and its captain request", async () => {
    const reg = await prisma.registration.create({
      data: { playerId: ids.player, seasonId: ids.season, divisionId: ids.division, totalAmount: 100, status: "SUBMITTED", paymentStatus: "UNPAID", playerNote: "itest-stripe-events" },
    });
    await prisma.captainRequest.create({ data: { playerId: ids.player, teamId: ids.team, registrationId: reg.id, note: "itest" } });
    const session = { id: "cs_itest_expired", object: "checkout.session", metadata: { type: "registration", organizationId: "org_nvasa", registrationId: reg.id } };
    expect(await send("checkout.session.expired", session)).toMatchObject({ status: 200, body: { released: true } });
    expect((await prisma.registration.findUniqueOrThrow({ where: { id: reg.id } })).status).toBe("CANCELLED");
    expect(await prisma.captainRequest.count({ where: { registrationId: reg.id } })).toBe(0);
    // Sent again: nothing left to release
    expect(await send("checkout.session.expired", session)).toMatchObject({ body: { released: false } });
  });

  it("leaves paid registrations and other checkout types alone", async () => {
    const paid = { id: "cs_itest_expired_paid", object: "checkout.session", metadata: { type: "registration", organizationId: "org_nvasa", registrationId: ids.regPaid } };
    expect(await send("checkout.session.expired", paid)).toMatchObject({ body: { released: false } });
    expect((await prisma.registration.findUniqueOrThrow({ where: { id: ids.regPaid } })).status).toBe("PENDING");
    const pass = { id: "cs_itest_expired_pass", object: "checkout.session", metadata: { type: "game_pass", organizationId: "org_nvasa", matchId: ids.m208, playerId: ids.player } };
    expect(await send("checkout.session.expired", pass)).toMatchObject({ status: 200, body: { released: false } });
  });
});
