import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auth, hasDb, type TestUser } from "./setup";

process.env.NEXTAUTH_SECRET ??= "test-secret";

describe.skipIf(!hasDb)("billing and adding players with billing (database)", async () => {
  const { default: prisma } = await import("@/lib/prisma");
  const billing = await import("@/lib/actions/billing");
  const admin = await import("@/lib/actions/admin");
  const { playerBilling } = await import("@/lib/queries/billing");
  const { seasonPayments } = await import("@/lib/queries/payments-report");

  const EMAILS = ["itest.bill.offline@example.com", "itest.bill.link@example.com", "itest.bill.waived@example.com", "itest.bill.later@example.com", "itest.bill.warn@example.com"];
  const ids = {} as Record<string, string>;
  let office: TestUser = null;
  let maya: TestUser = null;
  const as = (u: TestUser) => (auth.user = u);

  async function cleanup() {
    const regs = await prisma.registration.findMany({ where: { player: { user: { email: { in: EMAILS } } } }, select: { id: true } });
    await prisma.auditLog.deleteMany({ where: { entityId: { in: regs.map((r) => r.id) } } });
    await prisma.payment.deleteMany({ where: { player: { user: { email: { in: EMAILS } } } } });
    await prisma.registration.deleteMany({ where: { id: { in: regs.map((r) => r.id) } } });
    await prisma.user.deleteMany({ where: { email: { in: EMAILS } } });
  }

  beforeAll(async () => {
    await cleanup();
    const season = await prisma.season.findFirstOrThrow({ where: { isActive: true } });
    ids.season = season.id;
    ids.alx = (await prisma.team.findFirstOrThrow({ where: { seasonId: season.id, code: "alx" } })).id;
    ids.nvs = (await prisma.team.findFirstOrThrow({ where: { seasonId: season.id, code: "nvs" } })).id;
    const a = await prisma.user.findUniqueOrThrow({ where: { email: "safatash@gmail.com" } });
    office = { id: a.id, email: a.email, name: "Office", isAdmin: true };
    const m = await prisma.user.findUniqueOrThrow({ where: { email: "maya.johnson@example.com" }, include: { player: true } });
    maya = { id: m.id, email: m.email, name: "Maya", playerId: m.player!.id };
  });
  afterAll(cleanup);

  const person = (email: string, extra: object = {}) => ({
    firstName: "Ida",
    lastName: "Testbill",
    email,
    dob: "1995-02-02",
    gender: "FEMALE" as const,
    phone: "703-555-0199",
    address: "1 Main St",
    city: "Fairfax",
    state: "VA" as const,
    zip: "22030",
    tshirtSize: "M",
    emergencyName: "Pat Testbill",
    emergencyPhone: "703-555-0198",
    news: true,
    tournaments: true,
    sendInvite: false,
    ...extra,
  });
  const regOf = (email: string) => prisma.registration.findFirstOrThrow({ where: { player: { user: { email } } } });

  it("adds a player paid offline: approved, admin-created registration with the payment and audit trail", async () => {
    as(office);
    const res = await admin.createPlayerAccount(person(EMAILS[0], { teamId: ids.alx, billing: { mode: "OFFLINE", amount: 50, method: "CHECK", reference: "1042", paidOn: "2026-05-10" } }));
    expect(res).toMatchObject({ ok: true });
    const reg = await regOf(EMAILS[0]);
    expect(reg).toMatchObject({ status: "APPROVED", paymentStatus: "PARTIAL", createdByAdminId: office!.id, preferredTeamId: ids.alx });
    expect(Number(reg.totalAmount)).toBe(95);
    const p = await prisma.player.findFirstOrThrow({ where: { user: { email: EMAILS[0] } } });
    expect(p).toMatchObject({ emergencyContactName: "Pat Testbill", tshirtSize: "M", contactMe: true, tournaments: true, social: false, city: "Fairfax", state: "VA" });
    const b = (await playerBilling(p.id, ids.season))!;
    expect(b.summary).toMatchObject({ due: 95, paid: 50, balance: 45, status: "PARTIAL" });
    expect(b.ledger).toMatchObject([{ amount: 50, method: "Check", reference: "1042", recordedBy: "safatash@gmail.com" }]);
    expect(b.activity.length).toBeGreaterThan(0);
    ids.offlineReg = reg.id;
    ids.offlinePlayer = p.id;
  });

  it("records more payments, refunds and waivers; the status follows the ledger", async () => {
    as(office);
    expect(await billing.recordPayment({ registrationId: ids.offlineReg, amount: 60, method: "CASH", paidOn: "2026-05-11" })).toMatchObject({ ok: false, status: 409, error: expect.stringMatching(/\$45 balance/) });
    expect(await billing.recordPayment({ registrationId: ids.offlineReg, amount: 45, method: "CASH", paidOn: "2026-05-11" })).toMatchObject({ ok: true, data: { status: "PAID", balance: 0 } });
    expect(await billing.sendPaymentLink({ registrationId: ids.offlineReg })).toMatchObject({ ok: false, status: 409 });
    expect(await billing.refundPayment({ registrationId: ids.offlineReg, amount: 200, reason: "Too much" })).toMatchObject({ ok: false, status: 409 });
    expect(await billing.refundPayment({ registrationId: ids.offlineReg, amount: 20, reason: "Left the team", method: "CASH" })).toMatchObject({ ok: true });
    expect((await regOf(EMAILS[0])).paymentStatus).toBe("PARTIAL");
    expect(await billing.waiveBalance({ registrationId: ids.offlineReg, reason: "" })).toMatchObject({ ok: false, status: 400 });
    expect(await billing.waiveBalance({ registrationId: ids.offlineReg, reason: "Board decision" })).toMatchObject({ ok: true });
    expect((await regOf(EMAILS[0])).paymentStatus).toBe("WAIVED");
    expect(await billing.refundPayment({ registrationId: ids.offlineReg, amount: 75, reason: "Moved away" })).toMatchObject({ ok: true });
    // Nothing was deleted: five ledger rows
    const b = (await playerBilling(ids.offlinePlayer, ids.season))!;
    expect(b.ledger.map((r) => r.kind)).toEqual(["Payment", "Payment", "Refund", "Waived", "Refund"]);
    const actions = (await prisma.auditLog.findMany({ where: { entityId: ids.offlineReg } })).map((a) => a.action).sort();
    expect(actions).toEqual(["payment.recorded", "payment.refunded", "payment.refunded", "payment.waived", "registration.admin_created"]);
  });

  it("adds players with a payment link, waived, and collect-later", async () => {
    as(office);
    expect(await admin.createPlayerAccount(person(EMAILS[1], { teamId: ids.alx, billing: { mode: "LINK" } }))).toMatchObject({ ok: true, message: expect.stringMatching(/payment link sent/) });
    expect((await regOf(EMAILS[1])).paymentStatus).toBe("UNPAID");
    expect(await prisma.auditLog.count({ where: { entityId: (await regOf(EMAILS[1])).id, action: "payment.link_sent" } })).toBe(1);

    expect(await admin.createPlayerAccount(person(EMAILS[2], { teamId: ids.alx, billing: { mode: "WAIVED" } }))).toMatchObject({ ok: false, status: 400, error: expect.stringMatching(/reason/) });
    expect(await admin.createPlayerAccount(person(EMAILS[2], { teamId: ids.alx, billing: { mode: "WAIVED", notes: "Volunteer coach" } }))).toMatchObject({ ok: true });
    expect((await regOf(EMAILS[2])).paymentStatus).toBe("WAIVED");

    expect(await admin.createPlayerAccount(person(EMAILS[3], { teamId: ids.alx, billing: { mode: "LATER", amount: 60 } }))).toMatchObject({ ok: true });
    const later = await regOf(EMAILS[3]);
    expect(later.paymentStatus).toBe("UNPAID");
    expect(Number(later.totalAmount)).toBe(60);
    expect(Number(later.amountBeforeDiscount)).toBe(95);
  });

  it("warns about the blocklist, ZIP and age rules, and adds anyway on override", async () => {
    as(office);
    await prisma.blocklist.upsert({ where: { email: EMAILS[4] }, create: { email: EMAILS[4], reason: "itest" }, update: {} });
    try {
      const warn = await admin.createPlayerAccount(person(EMAILS[4], { zip: "90210", teamId: ids.nvs }));
      expect(warn).toMatchObject({ ok: false, status: 409 });
      if (!warn.ok) expect(warn.errors).toEqual([expect.stringMatching(/blocklist/), expect.stringMatching(/ZIP 90210/), expect.stringMatching(/Men D1/)]);
      expect(await prisma.user.count({ where: { email: EMAILS[4] } })).toBe(0);
      expect(await admin.createPlayerAccount(person(EMAILS[4], { zip: "90210", teamId: ids.nvs, override: true }))).toMatchObject({ ok: true });
      // Same email again is refused outright
      expect(await admin.createPlayerAccount(person(EMAILS[4], { override: true }))).toMatchObject({ ok: false, status: 409, error: expect.stringMatching(/already has an NVASA account/) });
    } finally {
      await prisma.blocklist.deleteMany({ where: { email: EMAILS[4] } });
    }
  });

  it("only the league office can bill, and the payments report totals the season", async () => {
    as(maya);
    expect(await billing.recordPayment({ registrationId: ids.offlineReg, amount: 1, method: "CASH", paidOn: "2026-05-11" })).toMatchObject({ ok: false, status: 403 });
    const report = await seasonPayments(ids.season, { method: "CHECK" });
    expect(report.rows.some((r) => r.reference === "1042" && r.amount === 50)).toBe(true);
    expect(report.rows.every((r) => r.method === "Check")).toBe(true);
    const all = await seasonPayments(ids.season);
    expect(all.totals.net).toBeCloseTo(all.totals.collected - all.totals.refunded);
  });
});
