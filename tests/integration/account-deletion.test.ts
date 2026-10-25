/**
 * Player self-service account deletion (src/lib/actions/account.ts): this league's profile is
 * anonymized, the league keeps its registrations, payments and ledger, the membership ends, and
 * the shared login is erased only when no other league uses it.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auth, hasDb, tenant } from "./setup";

describe.skipIf(!hasDb)("account deletion (database)", async () => {
  const { default: raw } = await import("@/platform/prisma");
  const { deleteMyAccount } = await import("@/lib/actions/account");
  const { deletedEmail } = await import("@/platform/accounts");
  const { authOptions } = await import("@/lib/auth");

  const NVASA = "org_nvasa";
  const DEMO = "org_demo";
  const emails = { solo: "itest-delete-solo@example.com", both: "itest-delete-both@example.com", staff: "itest-delete-staff@example.com" };
  const ids = {} as Record<"soloUser" | "soloPlayer" | "bothUser" | "bothNvasa" | "bothDemo" | "staffUser" | "staffPlayer" | "reg" | "payment" | "team", string>;

  const profile = (userId: string, organizationId: string, firstName: string) =>
    raw.player.create({
      data: { userId, organizationId, firstName, lastName: "Itest", gender: "FEMALE", dob: new Date("1990-04-02T00:00:00Z"), phone: "703-555-0101", address: "1 Main St", city: "Fairfax", state: "VA", zip: "22030", position: "MID", tshirtSize: "Adult M", emergencyContactName: "Kin Itest", emergencyContactPhone: "703-555-0102", contactMe: true },
    });

  async function cleanup() {
    const users = await raw.user.findMany({ where: { OR: [{ email: { in: Object.values(emails) } }, ...(ids.soloUser ? [{ id: { in: [ids.soloUser, ids.bothUser, ids.staffUser] } }] : [])] }, select: { id: true } });
    const userIds = users.map((u) => u.id);
    const players = await raw.player.findMany({ where: { userId: { in: userIds } }, select: { id: true } });
    const playerIds = players.map((p) => p.id);
    await raw.captainRequest.deleteMany({ where: { playerId: { in: playerIds } } });
    await raw.teamRoster.deleteMany({ where: { playerId: { in: playerIds } } });
    await raw.registration.deleteMany({ where: { playerId: { in: playerIds } } });
    await raw.payment.deleteMany({ where: { userId: { in: playerIds } } });
    await raw.auditLog.deleteMany({ where: { entityId: { in: playerIds } } });
    await raw.organizationMember.deleteMany({ where: { userId: { in: userIds } } });
    await raw.player.deleteMany({ where: { id: { in: playerIds } } });
    await raw.user.deleteMany({ where: { id: { in: userIds } } });
  }

  beforeAll(async () => {
    tenant.orgId = NVASA;
    await cleanup();
    const password = "$2a$10$abcdefghijklmnopqrstuuJ6jRtqmOeiExaG9mXhXzI1tnGJ6dmxe"; // not a real hash: sign-in never succeeds
    const solo = await raw.user.create({ data: { email: emails.solo, password } });
    const both = await raw.user.create({ data: { email: emails.both, password } });
    const soloPlayer = await profile(solo.id, NVASA, "Solo");
    const bothNvasa = await profile(both.id, NVASA, "Both");
    const bothDemo = await profile(both.id, DEMO, "Both");
    for (const [userId, organizationId] of [[solo.id, NVASA], [both.id, NVASA], [both.id, DEMO]] as const) {
      await raw.organizationMember.create({ data: { userId, organizationId, role: "PLAYER", status: "ACTIVE", joinedAt: new Date() } });
    }
    // League office staff who also plays
    const staff = await raw.user.create({ data: { email: emails.staff, password } });
    const staffPlayer = await profile(staff.id, NVASA, "Staff");
    await raw.organizationMember.create({ data: { userId: staff.id, organizationId: NVASA, role: "STAFF", status: "ACTIVE", joinedAt: new Date() } });
    const season = await raw.season.findFirstOrThrow({ where: { organizationId: NVASA, isActive: true } });
    const team = await raw.team.findFirstOrThrow({ where: { organizationId: NVASA, seasonId: season.id } });
    const reg = await raw.registration.create({ data: { organizationId: NVASA, playerId: soloPlayer.id, seasonId: season.id, divisionId: team.divisionId, totalAmount: 90, status: "APPROVED", paymentStatus: "PAID", playerNote: "Call me at 703-555-0101" } });
    const payment = await raw.payment.create({ data: { organizationId: NVASA, userId: soloPlayer.id, amount: 90, status: "PAID", paymentType: "REGISTRATION_FEE", relatedEntityType: "registration", relatedEntityId: reg.id, method: "CASH", paidAt: new Date() } });
    await raw.teamRoster.create({ data: { organizationId: NVASA, playerId: soloPlayer.id, teamId: team.id, divisionId: team.divisionId, membershipType: "SEASONAL" } });
    await raw.captainRequest.create({ data: { organizationId: NVASA, playerId: soloPlayer.id, teamId: team.id, registrationId: reg.id, status: "PENDING" } });
    Object.assign(ids, { staffUser: staff.id, staffPlayer: staffPlayer.id, soloUser: solo.id, soloPlayer: soloPlayer.id, bothUser: both.id, bothNvasa: bothNvasa.id, bothDemo: bothDemo.id, reg: reg.id, payment: payment.id, team: team.id });
  });
  afterAll(async () => {
    await cleanup();
    auth.user = null;
    tenant.orgId = NVASA;
  });

  it("asks for the account's email, and the league office can't delete itself this way", async () => {
    auth.user = { id: ids.soloUser, email: emails.solo, name: "Solo", playerId: ids.soloPlayer };
    expect(await deleteMyAccount({ confirmEmail: "someone@else.com" })).toMatchObject({ ok: false, status: 400 });
    auth.user = { id: ids.staffUser, email: emails.staff, name: "Staff", playerId: ids.staffPlayer };
    expect(await deleteMyAccount({ confirmEmail: emails.staff })).toMatchObject({ ok: false, status: 409, error: expect.stringContaining("league office") });
    expect((await raw.player.findUniqueOrThrow({ where: { id: ids.staffPlayer } })).anonymizedAt).toBeNull();
    expect((await raw.player.findUniqueOrThrow({ where: { id: ids.soloPlayer } })).anonymizedAt).toBeNull();
  });

  it("anonymizes the profile, keeps the league's records, ends the membership and erases an unused login", async () => {
    auth.user = { id: ids.soloUser, email: emails.solo, name: "Solo", playerId: ids.soloPlayer };
    expect(await deleteMyAccount({ confirmEmail: emails.solo.toUpperCase() })).toMatchObject({ ok: true, data: { loginErased: true } });

    const p = await raw.player.findUniqueOrThrow({ where: { id: ids.soloPlayer } });
    expect(p).toMatchObject({ firstName: "Deleted", lastName: "player", phone: "", address: "", zip: "", emergencyContactName: null, emergencyContactPhone: null, contactMe: false, status: "INACTIVE" });
    expect(p.dob.toISOString().slice(0, 10)).toBe("1900-01-01");
    expect(p.anonymizedAt).not.toBeNull();
    // The league's records stay
    expect(await raw.payment.findUnique({ where: { id: ids.payment } })).toMatchObject({ amount: expect.anything(), status: "PAID" });
    expect(await raw.registration.findUnique({ where: { id: ids.reg } })).toMatchObject({ status: "APPROVED", paymentStatus: "PAID", playerNote: null });
    expect(await raw.teamRoster.count({ where: { playerId: ids.soloPlayer, leftAt: null } })).toBe(0);
    expect(await raw.captainRequest.count({ where: { playerId: ids.soloPlayer } })).toBe(0);
    expect((await raw.organizationMember.findFirstOrThrow({ where: { userId: ids.soloUser } })).status).toBe("REMOVED");
    // The login is gone
    expect((await raw.user.findUniqueOrThrow({ where: { id: ids.soloUser } })).email).toBe(deletedEmail(ids.soloUser));
    const authorize = (authOptions.providers[0] as unknown as { options: { authorize: (c: Record<string, string>) => Promise<unknown> } }).options.authorize;
    await expect(authorize({ email: emails.solo, password: "anything" })).rejects.toThrow();
    // Again: already done
    expect(await deleteMyAccount({ confirmEmail: deletedEmail(ids.soloUser) })).toMatchObject({ ok: false, status: 409 });
  });

  it("keeps the login and the other league's profile when another league still uses them", async () => {
    auth.user = { id: ids.bothUser, email: emails.both, name: "Both", playerId: ids.bothNvasa };
    expect(await deleteMyAccount({ confirmEmail: emails.both })).toMatchObject({ ok: true, data: { loginErased: false } });
    expect((await raw.player.findUniqueOrThrow({ where: { id: ids.bothNvasa } })).firstName).toBe("Deleted");
    expect(await raw.player.findUniqueOrThrow({ where: { id: ids.bothDemo } })).toMatchObject({ firstName: "Both", anonymizedAt: null, phone: "703-555-0101" });
    expect((await raw.user.findUniqueOrThrow({ where: { id: ids.bothUser } })).email).toBe(emails.both);
    const memberships = await raw.organizationMember.findMany({ where: { userId: ids.bothUser }, orderBy: { organizationId: "asc" } });
    expect(memberships.map((m) => [m.organizationId, m.status])).toEqual([
      [DEMO, "ACTIVE"],
      [NVASA, "REMOVED"],
    ]);
  });
});
