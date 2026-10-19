/**
 * Phase 4: the operator area (only isPlatformAdmin, only on the platform host), creating and
 * managing leagues, impersonation with audit, signup, and the first-season template.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auth, hasDb, tenant, type TestUser } from "./setup";

const NVASA = "org_nvasa";
const SLUGS = ["itest-pilot", "itest-signup"];
const EMAILS = ["itest.pilot.owner@example.com", "itest.signup.owner@example.com"];
const PLATFORM = ""; // no league: the root domain

describe.skipIf(!hasDb)("platform layer (database)", async () => {
  const { default: raw } = await import("@/platform/prisma");
  const platform = await import("@/platform/actions");
  const { signUp } = await import("@/platform/signup");
  const { stopImpersonating } = await import("@/lib/actions/impersonation");
  const { updateLeagueProfile } = await import("@/lib/actions/league-profile");
  const { createSeason } = await import("@/lib/actions/admin-structure");
  const { setupSteps } = await import("@/lib/queries/setup");
  const { authOptions } = await import("@/lib/auth");
  const { forgetOrg } = await import("@/platform/orgs");

  const users = {} as Record<"operator" | "maya", TestUser>;
  const ids = {} as Record<"pilot" | "signup", string>;
  const authorize = (i: number) => (authOptions.providers[i] as unknown as { options: { authorize: (c: Record<string, string>) => Promise<unknown> } }).options.authorize;

  async function cleanup() {
    const orgs = await raw.organization.findMany({ where: { slug: { in: SLUGS } }, select: { id: true } });
    const w = { organizationId: { in: orgs.map((o) => o.id) } };
    await raw.auditLog.deleteMany({ where: w });
    await raw.impersonation.deleteMany({ where: w });
    await raw.division.deleteMany({ where: w });
    await raw.leagueSettings.deleteMany({ where: w });
    await raw.season.deleteMany({ where: w });
    await raw.position.deleteMany({ where: w });
    await raw.tshirtSize.deleteMany({ where: w });
    await raw.organizationMember.deleteMany({ where: w });
    await raw.organizationSettings.deleteMany({ where: w });
    await raw.organization.deleteMany({ where: { slug: { in: SLUGS } } });
    await raw.verificationToken.deleteMany({ where: { identifier: { in: (await raw.user.findMany({ where: { email: { in: EMAILS } } })).flatMap((u) => [`login:${u.id}`, `reset:${u.id}`]) } } });
    await raw.user.deleteMany({ where: { email: { in: EMAILS } } });
    forgetOrg();
  }

  beforeAll(async () => {
    await cleanup();
    const op = await raw.user.findUniqueOrThrow({ where: { email: "safatash@gmail.com" } });
    const maya = await raw.user.findUniqueOrThrow({ where: { email: "maya.johnson@example.com" } });
    users.operator = { id: op.id, email: op.email, name: "Operator" };
    users.maya = { id: maya.id, email: maya.email, name: "Maya" };
    await raw.impersonation.deleteMany({ where: { userId: op.id } });
  });
  afterAll(async () => {
    await cleanup();
    await raw.impersonation.deleteMany({ where: { userId: users.operator!.id } });
    tenant.orgId = NVASA;
    auth.user = null;
  });

  it("only the operator, and only on the platform host", async () => {
    tenant.orgId = PLATFORM;
    auth.user = users.maya;
    expect(await platform.createOrganizationAction({ name: "Itest Pilot", slug: SLUGS[0], ownerEmail: EMAILS[0] })).toMatchObject({ ok: false, status: 403 });
    auth.user = users.operator;
    tenant.orgId = NVASA; // on a league's address the operator area doesn't exist
    expect(await platform.createOrganizationAction({ name: "Itest Pilot", slug: SLUGS[0], ownerEmail: EMAILS[0] })).toMatchObject({ ok: false, status: 403 });
  });

  it("creates a league in a 30-day trial with an invited owner", async () => {
    tenant.orgId = PLATFORM;
    auth.user = users.operator;
    expect(await platform.createOrganizationAction({ name: "Itest", slug: "admin", ownerEmail: EMAILS[0] })).toMatchObject({ ok: false, status: 409 });
    expect(await platform.createOrganizationAction({ name: "Itest", slug: "nvasa", ownerEmail: EMAILS[0] })).toMatchObject({ ok: false, status: 409, error: expect.stringMatching(/taken/) });
    const res = await platform.createOrganizationAction({ name: "Itest Pilot", slug: SLUGS[0], ownerEmail: EMAILS[0] });
    expect(res).toMatchObject({ ok: true });
    ids.pilot = (res as { data: { id: string } }).data.id;
    const org = await raw.organization.findUniqueOrThrow({ where: { id: ids.pilot }, include: { settings: true, members: { include: { user: true } } } });
    expect(org).toMatchObject({ status: "TRIAL", slug: SLUGS[0] });
    expect(Math.round((org.trialEndsAt!.getTime() - Date.now()) / 86_400_000)).toBe(30);
    expect(org.settings).not.toBeNull();
    expect(org.members).toMatchObject([{ role: "OWNER", user: { email: EMAILS[0] } }]);
    expect(await raw.verificationToken.count({ where: { identifier: `reset:${org.members[0].userId}` } })).toBe(1);
    expect(await raw.auditLog.count({ where: { organizationId: ids.pilot, action: "org.created", actorEmail: "safatash@gmail.com" } })).toBe(1);
  });

  it("changes status and plan, and extends the trial, with audit entries", async () => {
    tenant.orgId = PLATFORM;
    auth.user = users.operator;
    expect(await platform.setOrganizationPlan({ id: ids.pilot, plan: "founding" })).toMatchObject({ ok: true });
    expect(await platform.setOrganizationStatus({ id: ids.pilot, status: "SUSPENDED" })).toMatchObject({ ok: true });
    const before = (await raw.organization.findUniqueOrThrow({ where: { id: ids.pilot } })).trialEndsAt!;
    expect(await platform.extendTrial({ id: ids.pilot, days: 14 })).toMatchObject({ ok: true });
    const org = await raw.organization.findUniqueOrThrow({ where: { id: ids.pilot } });
    expect(org).toMatchObject({ plan: "founding", status: "TRIAL" });
    expect(Math.round((org.trialEndsAt!.getTime() - before.getTime()) / 86_400_000)).toBe(14);
    expect(await raw.auditLog.count({ where: { organizationId: ids.pilot, action: "org.updated" } })).toBe(3);
  });

  it("impersonation: acts as an admin while active, is audited, and ends on stop or expiry", async () => {
    tenant.orgId = PLATFORM;
    auth.user = users.maya;
    expect(await platform.impersonateAdmin({ id: ids.pilot })).toMatchObject({ ok: false, status: 403 });

    // Before: the operator has no role in the league
    tenant.orgId = ids.pilot;
    auth.user = users.operator;
    const profile = { name: "Itest Pilot", timezone: "America/New_York", contactEmail: EMAILS[0] };
    expect(await updateLeagueProfile(profile)).toMatchObject({ ok: false, status: 403 });

    tenant.orgId = PLATFORM;
    const res = await platform.impersonateAdmin({ id: ids.pilot, reason: "Itest support" });
    expect(res).toMatchObject({ ok: true });
    const url = new URL((res as { data: { url: string } }).data.url);
    expect(url.hostname.startsWith(`${SLUGS[0]}.`)).toBe(true);
    expect(url.pathname).toBe("/login/link");
    expect(url.searchParams.get("next")).toBe("/admin");

    // The one-time link signs the operator in on the league's address
    tenant.orgId = ids.pilot;
    await expect(authorize(1)({ token: url.searchParams.get("token")! })).resolves.toMatchObject({ email: "safatash@gmail.com" });
    const session = (await authOptions.callbacks!.session!({ session: { user: {}, expires: "" }, token: { sub: users.operator!.id } } as never)) as { user: { isAdmin: boolean; impersonating: boolean } };
    expect(session.user).toMatchObject({ isAdmin: true, impersonating: true });
    expect(await updateLeagueProfile({ ...profile, fullName: "Itest Pilot League" })).toMatchObject({ ok: true });
    expect(await raw.auditLog.findFirst({ where: { organizationId: ids.pilot, action: "league.profile" } })).toMatchObject({ actorEmail: "safatash@gmail.com" });
    // Not in other leagues
    tenant.orgId = "org_demo";
    expect(await updateLeagueProfile({ ...profile, name: "Hacked" })).toMatchObject({ ok: false, status: 403 });

    tenant.orgId = ids.pilot;
    expect(await stopImpersonating()).toMatchObject({ ok: true, data: { url: expect.stringMatching(new RegExp(`/platform/orgs/${ids.pilot}$`)) } });
    expect(await updateLeagueProfile(profile)).toMatchObject({ ok: false, status: 403 });
    const actions = (await raw.auditLog.findMany({ where: { organizationId: ids.pilot, action: { startsWith: "impersonation." } }, orderBy: { createdAt: "asc" } })).map((a) => a.action);
    expect(actions).toEqual(["impersonation.started", "impersonation.stopped"]);

    // Expired impersonations give nothing
    tenant.orgId = PLATFORM;
    await platform.impersonateAdmin({ id: ids.pilot });
    await raw.impersonation.updateMany({ where: { organizationId: ids.pilot, endedAt: null }, data: { expiresAt: new Date(Date.now() - 1000) } });
    tenant.orgId = ids.pilot;
    expect(await updateLeagueProfile(profile)).toMatchObject({ ok: false, status: 403 });
  });

  it("signs in on the platform host only as the operator", async () => {
    tenant.orgId = PLATFORM;
    await expect(authorize(0)({ email: "maya.johnson@example.com", password: "MayaJohnson26" })).rejects.toThrow();
    await expect(authorize(0)({ email: "safatash@gmail.com", password: "Admin123!" })).resolves.toMatchObject({ email: "safatash@gmail.com" });
  });

  it("signup: a league, its owner and a sign-in link to the setup checklist", async () => {
    tenant.orgId = PLATFORM;
    auth.user = null;
    const base = { leagueName: "Itest Signup League", slug: SLUGS[1], email: EMAILS[1], password: "GoodPassword26" };
    expect(await signUp({ ...base, website: "http://spam" })).toMatchObject({ ok: false });
    expect(await signUp({ ...base, password: "short" })).toMatchObject({ ok: false, error: expect.stringMatching(/10 characters/) });
    expect(await signUp({ ...base, slug: "www" })).toMatchObject({ ok: false, error: expect.stringMatching(/reserved/) });
    expect(await signUp({ ...base, email: "maya.johnson@example.com", password: "WrongPassword26" })).toMatchObject({ ok: false, error: expect.stringMatching(/already has an account/) });
    const res = await signUp(base);
    expect(res).toMatchObject({ ok: true });
    const url = new URL((res as { url: string }).url);
    expect(url.hostname.startsWith(`${SLUGS[1]}.`)).toBe(true);
    expect(url.searchParams.get("next")).toBe("/admin/setup");
    const org = await raw.organization.findUniqueOrThrow({ where: { slug: SLUGS[1] }, include: { members: true } });
    ids.signup = org.id;
    expect(org).toMatchObject({ status: "TRIAL", name: "Itest Signup League" });
    expect(org.members).toMatchObject([{ role: "OWNER", status: "ACTIVE" }]);

    tenant.orgId = org.id;
    const owner = await raw.user.findUniqueOrThrow({ where: { email: EMAILS[1] } });
    await expect(authorize(1)({ token: url.searchParams.get("token")! })).resolves.toMatchObject({ email: EMAILS[1] });
    // Their login doesn't open other leagues
    tenant.orgId = NVASA;
    await expect(authorize(0)({ email: EMAILS[1], password: "GoodPassword26" })).rejects.toThrow();
    tenant.orgId = org.id;
    auth.user = { id: owner.id, email: owner.email, name: "Owner" };
    expect((await setupSteps()).filter((s) => s.done).map((s) => s.key)).toEqual([]);
  });

  it("the first season can start from the adult rec template, in that league only", async () => {
    tenant.orgId = ids.signup;
    const nvasaPositions = await raw.position.count({ where: { organizationId: NVASA } });
    const res = await createSeason({ name: "Itest Spring", startDate: "2027-04-04", endDate: "2027-06-27", makeActive: true, template: "ADULT_REC" });
    expect(res).toMatchObject({ ok: true, message: expect.stringMatching(/5 starter divisions/) });
    const divisions = await raw.division.findMany({ where: { organizationId: ids.signup }, orderBy: { displayOrder: "asc" } });
    expect(divisions.map((d) => d.code)).toEqual(["wp", "md1", "d3", "mc", "cc"]);
    expect(divisions[0].femaleBornOnOrBefore?.toISOString().slice(0, 10)).toBe("2009-04-04");
    expect(await raw.position.count({ where: { organizationId: ids.signup } })).toBe(11);
    expect(await raw.tshirtSize.count({ where: { organizationId: ids.signup } })).toBe(9);
    expect(await raw.position.count({ where: { organizationId: NVASA } })).toBe(nvasaPositions);
    expect((await setupSteps()).filter((s) => s.done).map((s) => s.key)).toEqual(["season", "divisions"]);
  });
});
