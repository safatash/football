/**
 * Stripe Connect Express (Batch 5): onboarding, the Connect webhook, destination charges with
 * the platform fee, the "pay later" fallback for leagues that can't take payments yet, and the
 * webhook recording which account got the money. Stripe is faked: nothing leaves the machine.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { auth, hasDb, tenant } from "./setup";

const fake = vi.hoisted(() => ({ sessions: [] as Record<string, unknown>[], accounts: [] as Record<string, unknown>[], links: [] as Record<string, unknown>[] }));
vi.mock("@/lib/stripe", () => ({
  stripe: () => ({
    checkout: {
      sessions: {
        create: async (p: Record<string, unknown>) => {
          fake.sessions.push(p);
          return { id: `cs_itest_${fake.sessions.length}`, url: "https://checkout.stripe.test/pay" };
        },
      },
    },
    accounts: {
      create: async (p: Record<string, unknown>) => {
        fake.accounts.push(p);
        return { id: "acct_itest_demo" };
      },
      retrieve: async (id: string) => ({ id, charges_enabled: true, payouts_enabled: true, details_submitted: true }),
      createLoginLink: async () => ({ url: "https://connect.stripe.test/express" }),
    },
    accountLinks: {
      create: async (p: Record<string, unknown>) => {
        fake.links.push(p);
        return { url: "https://connect.stripe.test/onboarding" };
      },
    },
  }),
}));

describe.skipIf(!hasDb)("Stripe Connect (database)", async () => {
  const { NextRequest } = await import("next/server");
  const { default: raw } = await import("@/platform/prisma");
  const { runWithOrg } = await import("@/lib/db");
  const { feeFor, paymentsMode } = await import("@/platform/payments");
  const { createLeagueCheckout, OnlinePaymentsUnavailable } = await import("@/lib/league-checkout");
  const { startPaymentsOnboarding } = await import("@/lib/actions/online-payments");
  const connectHook = await import("@/app/api/stripe/connect-webhook/route");
  const mainHook = await import("@/app/api/stripe/webhook/route");
  const registerRoute = await import("@/app/api/register/new/route");
  const { checkEligibility } = await import("@/lib/eligibility");

  const NVASA = "org_nvasa";
  const DEMO = "org_demo";
  const ACCT = "acct_itest_demo";
  const line = (cents: number) => [{ quantity: 1, price_data: { currency: "usd", unit_amount: cents, product_data: { name: "Itest" } } }];
  const checkoutFor = (orgId: string, cents = 9500) =>
    runWithOrg(orgId, () => createLeagueCheckout({ mode: "payment", line_items: line(cents), success_url: "https://x.test/ok", cancel_url: "https://x.test/no", metadata: { type: "registration_balance", registrationId: "r1" } }));
  const post = async (handler: (r: InstanceType<typeof NextRequest>) => Promise<Response>, body: unknown) => {
    // Unsigned test events; Prisma may have loaded a local .env with real secrets
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
    const res = await handler(new NextRequest("http://localhost/api/stripe/x", { method: "POST", body: JSON.stringify(body) }));
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };

  let demoBefore: Record<string, unknown>;
  let demoOwner: { id: string; email: string };
  let regId = "";
  let demoPlayer: { id: string; userId: string; email: string; division: string } | null = null;

  async function cleanup() {
    const regs = await raw.registration.findMany({ where: { organizationId: DEMO, playerNote: "itest-connect" }, select: { id: true } });
    await raw.payment.deleteMany({ where: { OR: [{ stripeChargeId: { startsWith: "cs_itest_connect" } }, { relatedEntityId: { in: regs.map((r) => r.id) } }] } });
    await raw.registration.deleteMany({ where: { id: { in: regs.map((r) => r.id) } } });
    await raw.stripeEvent.deleteMany({ where: { id: { startsWith: "evt_itest_connect" } } });
    const u = await raw.user.findUnique({ where: { email: "itest-connect-player@example.com" }, select: { id: true } });
    if (u) {
      const players = await raw.player.findMany({ where: { userId: u.id }, select: { id: true } });
      await raw.registration.deleteMany({ where: { playerId: { in: players.map((p) => p.id) } } });
      await raw.organizationMember.deleteMany({ where: { userId: u.id } });
      await raw.player.deleteMany({ where: { userId: u.id } });
      await raw.user.delete({ where: { id: u.id } });
    }
  }

  beforeAll(async () => {
    process.env.STRIPE_SECRET_KEY ||= "sk_test_itest";
    const org = await raw.organization.findUniqueOrThrow({ where: { id: DEMO } });
    demoBefore = { stripeAccountId: org.stripeAccountId, stripeChargesEnabled: org.stripeChargesEnabled, stripePayoutsEnabled: org.stripePayoutsEnabled, stripeDetailsSubmitted: org.stripeDetailsSubmitted, platformFeeBps: org.platformFeeBps, legacyPlatformPayments: org.legacyPlatformPayments };
    await raw.organization.update({ where: { id: DEMO }, data: { stripeAccountId: null, stripeChargesEnabled: false, stripePayoutsEnabled: false, stripeDetailsSubmitted: false, platformFeeBps: 100, legacyPlatformPayments: false } });
    await cleanup();
    const owner = await raw.user.findUniqueOrThrow({ where: { email: "demo.office@example.com" } });
    demoOwner = { id: owner.id, email: owner.email };
    // A Demo League player and an open division they can register for
    const season = await raw.season.findFirstOrThrow({ where: { organizationId: DEMO, isActive: true } });
    const divisions = await raw.division.findMany({ where: { organizationId: DEMO, seasonId: season.id, status: "ACTIVE", registrationFee: { gt: 0 } } });
    // A fresh Demo League player (a plain PLAYER member) with no registrations
    const user = await raw.user.create({ data: { email: "itest-connect-player@example.com", password: "$2a$10$abcdefghijklmnopqrstuuJ6jRtqmOeiExaG9mXhXzI1tnGJ6dmxe" } });
    const player = await raw.player.create({
      data: { organizationId: DEMO, userId: user.id, firstName: "Connect", lastName: "Itest", gender: "FEMALE", dob: new Date("1990-04-02T00:00:00Z"), phone: "703-555-0110", address: "1 Main St", city: "Fairfax", state: "VA", zip: "22030", position: "MID", tshirtSize: "Adult M" },
    });
    await raw.organizationMember.create({ data: { userId: user.id, organizationId: DEMO, role: "PLAYER", status: "ACTIVE", joinedAt: new Date() } });
    const d = divisions.find((x) => checkEligibility(x, { dob: player.dob, gender: player.gender }, season.startDate).ok);
    if (d) demoPlayer = { id: player.id, userId: user.id, email: user.email, division: d.code };
    const reg = await raw.registration.create({ data: { organizationId: DEMO, playerId: (await raw.player.findFirstOrThrow({ where: { organizationId: DEMO } })).id, seasonId: season.id, totalAmount: 95, status: "APPROVED", paymentStatus: "UNPAID", playerNote: "itest-connect" } });
    regId = reg.id;
  });

  afterAll(async () => {
    await cleanup();
    await raw.organization.update({ where: { id: DEMO }, data: demoBefore });
    auth.user = null;
    tenant.orgId = NVASA;
  });

  it("the fee is basis points of the total, and the mode follows the account", () => {
    // 1% platform + Stripe's 2.9% + 30¢ processing, passed on to the league
    expect(feeFor(100, 9500)).toBe(95 + 276 + 30);
    expect(feeFor(0, 9500)).toBe(276 + 30); // comped: processing only
    expect(feeFor(250, 4999, { bps: 0, cents: 0 })).toBe(125);
    expect(feeFor(100, 0)).toBe(0);
    expect(feeFor(100, 20)).toBe(20); // never more than the charge
    expect(paymentsMode({ stripeAccountId: "acct_1", stripeChargesEnabled: true, legacyPlatformPayments: false })).toBe("connected");
    expect(paymentsMode({ stripeAccountId: "acct_1", stripeChargesEnabled: false, legacyPlatformPayments: true })).toBe("legacy");
    expect(paymentsMode({ stripeAccountId: null, stripeChargesEnabled: false, legacyPlatformPayments: false })).toBe("not-ready");
  });

  it("a league that isn't connected can't take online payments: registration goes to the office unpaid", async () => {
    await expect(checkoutFor(DEMO)).rejects.toBeInstanceOf(OnlinePaymentsUnavailable);
    expect(demoPlayer).not.toBeNull();
    tenant.orgId = DEMO;
    auth.user = { id: demoPlayer!.userId, email: demoPlayer!.email, name: "Demo player", playerId: demoPlayer!.id };
    const before = fake.sessions.length;
    const res = await registerRoute.POST(
      new NextRequest("http://localhost/api/register/new", {
        method: "POST",
        body: JSON.stringify({ divisionCode: demoPlayer!.division, waiverAccepted: true, emergencyName: "Kin Demo", emergencyPhone: "703-555-0111" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(((await res.json()) as { checkoutUrl: string }).checkoutUrl).toMatch(/^\/register\/success\?registration=/);
    expect(fake.sessions.length).toBe(before); // no Stripe checkout
    const reg = await raw.registration.findFirstOrThrow({ where: { organizationId: DEMO, playerId: demoPlayer!.id }, orderBy: { createdAt: "desc" } });
    expect(reg).toMatchObject({ status: "PENDING", paymentStatus: "UNPAID" });
    tenant.orgId = NVASA;
  });

  it("onboarding: an owner gets a Stripe link, and the league gets one account however often they click", async () => {
    tenant.orgId = DEMO;
    auth.user = { id: demoOwner.id, email: demoOwner.email, name: "Demo office", isAdmin: true };
    const first = await startPaymentsOnboarding();
    expect(first).toMatchObject({ ok: true, data: { url: "https://connect.stripe.test/onboarding" } });
    expect(await startPaymentsOnboarding()).toMatchObject({ ok: true });
    expect(fake.accounts).toHaveLength(1);
    expect(fake.accounts[0]).toMatchObject({ type: "express", country: "US", metadata: { organizationId: DEMO } });
    expect(fake.links.at(-1)).toMatchObject({ account: ACCT, type: "account_onboarding", return_url: expect.stringContaining("/admin/settings/online-payments?stripe=return") });
    expect((await raw.organization.findUniqueOrThrow({ where: { id: DEMO } })).stripeAccountId).toBe(ACCT);
    // A player can't
    auth.user = demoPlayer ? { id: demoPlayer.userId, email: demoPlayer.email, name: "Demo player", playerId: demoPlayer.id } : null;
    expect(await startPaymentsOnboarding()).toMatchObject({ ok: false, status: 403 });
    tenant.orgId = NVASA;
  });

  it("the Connect webhook updates the league that owns the account, once per event", async () => {
    const event = { id: "evt_itest_connect_1", type: "account.updated", account: ACCT, data: { object: { id: ACCT, charges_enabled: true, payouts_enabled: true, details_submitted: true } } };
    expect(await post(connectHook.POST, event)).toMatchObject({ status: 200, body: { received: true } });
    expect(await raw.organization.findUniqueOrThrow({ where: { id: DEMO } })).toMatchObject({ stripeChargesEnabled: true, stripePayoutsEnabled: true, stripeDetailsSubmitted: true });
    expect(await post(connectHook.POST, event)).toMatchObject({ body: { duplicate: true } });
    expect(await post(connectHook.POST, { ...event, id: "evt_itest_connect_2", account: "acct_nobody" })).toMatchObject({ status: 200, body: { ignored: "unknown account" } });
  });

  it("a connected league's checkout is a destination charge with the platform fee", async () => {
    await checkoutFor(DEMO, 9500);
    expect(fake.sessions.at(-1)).toMatchObject({
      metadata: { organizationId: DEMO, stripeAccountId: ACCT, applicationFee: "401" },
      payment_intent_data: { on_behalf_of: ACCT, transfer_data: { destination: ACCT }, application_fee_amount: 401, metadata: { organizationId: DEMO } },
    });
    // Comped league: no platform fee, the league still pays card processing
    await raw.organization.update({ where: { id: DEMO }, data: { platformFeeBps: 0 } });
    await checkoutFor(DEMO, 9500);
    const comped = fake.sessions.at(-1) as { payment_intent_data: Record<string, unknown>; metadata: Record<string, string> };
    expect(comped.payment_intent_data).toMatchObject({ application_fee_amount: 306 });
    expect(comped.metadata.applicationFee).toBe("306");
    await raw.organization.update({ where: { id: DEMO }, data: { platformFeeBps: 100 } });
  });

  it("NVASA, set up before Connect, still takes payments on the platform account", async () => {
    expect((await raw.organization.findUniqueOrThrow({ where: { id: NVASA } })).legacyPlatformPayments).toBe(true);
    await checkoutFor(NVASA);
    const s = fake.sessions.at(-1) as { payment_intent_data: Record<string, unknown>; metadata: Record<string, string> };
    expect(s.payment_intent_data).not.toHaveProperty("transfer_data");
    expect(s.metadata).toMatchObject({ organizationId: NVASA });
    expect(s.metadata).not.toHaveProperty("stripeAccountId");
  });

  it("the payment webhook records the account and fee, and rejects an account that isn't the league's", async () => {
    const session = (id: string, account: string) => ({
      id,
      object: "checkout.session",
      amount_total: 9500,
      currency: "usd",
      payment_intent: `pi_${id}`,
      metadata: { type: "registration_balance", organizationId: DEMO, registrationId: regId, stripeAccountId: account, applicationFee: "95" },
    });
    expect(await post(mainHook.POST, { id: "evt_itest_connect_pay", type: "checkout.session.completed", data: { object: session("cs_itest_connect_ok", ACCT) } })).toMatchObject({ status: 200 });
    const pay = await raw.payment.findUniqueOrThrow({ where: { stripeChargeId: "cs_itest_connect_ok" } });
    expect(pay.stripeAccountId).toBe(ACCT);
    expect(Number(pay.applicationFeeAmount)).toBe(0.95);
    expect(await post(mainHook.POST, { id: "evt_itest_connect_bad", type: "checkout.session.completed", data: { object: session("cs_itest_connect_bad", "acct_someone_else") } })).toMatchObject({ status: 400 });
    expect(await raw.payment.findUnique({ where: { stripeChargeId: "cs_itest_connect_bad" } })).toBeNull();
  });
});
