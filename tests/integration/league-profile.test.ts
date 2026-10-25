/**
 * Phase 3: each league's name, colors and contacts come from its organization, its emails go out
 * "{League} via {App}" with replies to the league, the old .cfm links only work for NVASA, and the
 * League profile and Staff pages only change the current league.
 */
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auth, hasDb, tenant, type TestUser } from "./setup";

const NVASA = "org_nvasa";
const DEMO = "org_demo";
const INVITE = "itest.staff.invite@example.com";

describe.skipIf(!hasDb)("league branding, profile and staff (database)", async () => {
  const { default: raw } = await import("@/platform/prisma");
  const { brandFor, getBrand } = await import("@/lib/branding");
  const { senderFor } = await import("@/lib/mail");
  const { loginLinkEmail } = await import("@/lib/mail-templates");
  const { updateLeagueProfile } = await import("@/lib/actions/league-profile");
  const staff = await import("@/lib/actions/staff");
  const { forgetOrg } = await import("@/platform/orgs");
  const teamCfm = await import("@/app/team.cfm/route");

  const users = {} as Record<"demoOwner" | "nvasaAdmin" | "maya", TestUser>;
  let demoBefore: Awaited<ReturnType<typeof raw.organization.findUniqueOrThrow>>;
  const profile = (over: Record<string, unknown> = {}) => ({
    name: "Demo League",
    fullName: "Springfield Demo Soccer League",
    tagline: "A sample league for trying the app.",
    primaryColor: "#1C5598",
    accentColor: "#F5B700",
    contactEmail: "office@demo-league.example.com",
    supportEmail: "",
    timezone: "America/Chicago",
    waiverText: "Itest waiver",
    logoUrl: "",
    facebookUrl: "",
    twitterUrl: "",
    instagramUrl: "",
    ...over,
  });

  async function cleanup() {
    await raw.organizationMember.deleteMany({ where: { user: { email: INVITE } } });
    await raw.user.deleteMany({ where: { email: INVITE } });
    await raw.auditLog.deleteMany({ where: { OR: [{ summary: { contains: INVITE } }, { action: { startsWith: "league." }, organizationId: DEMO }] } });
  }

  beforeAll(async () => {
    await cleanup();
    demoBefore = await raw.organization.findUniqueOrThrow({ where: { id: DEMO } });
    const owner = await raw.user.findUniqueOrThrow({ where: { email: "demo.office@example.com" } });
    const office = await raw.user.findUniqueOrThrow({ where: { email: "safatash@gmail.com" } });
    const maya = await raw.user.findUniqueOrThrow({ where: { email: "maya.johnson@example.com" } });
    users.demoOwner = { id: owner.id, email: owner.email, name: "Demo office", isAdmin: true };
    users.nvasaAdmin = { id: office.id, email: office.email, name: "NVASA office", isAdmin: true };
    users.maya = { id: maya.id, email: maya.email, name: "Maya" };
  });
  afterAll(async () => {
    await cleanup();
    const { name, fullName, tagline, primaryColor, accentColor, contactEmail, supportEmail, timezone, logoUrl, facebookUrl, twitterUrl, instagramUrl } = demoBefore;
    await raw.organization.update({ where: { id: DEMO }, data: { name, fullName, tagline, primaryColor, accentColor, contactEmail, supportEmail, timezone, logoUrl, facebookUrl, twitterUrl, instagramUrl } });
    await raw.organizationSettings.update({ where: { organizationId: DEMO }, data: { waiverText: null } });
    forgetOrg();
    tenant.orgId = NVASA;
    auth.user = null;
  });

  it("each league has its own name, contacts and address", async () => {
    const nv = await brandFor(NVASA);
    expect(nv).toMatchObject({ name: "NVASA", fullName: "Northern Virginia Adult Soccer", contactEmail: "office@nvasa.org", slug: "nvasa" });
    expect(nv.social.map((s) => s.label)).toEqual(["Facebook", "X (Twitter)"]);
    expect(nv.url).toMatch(/^https?:\/\/nvasa\./);
    const demo = await brandFor(DEMO);
    expect(demo).toMatchObject({ name: "Demo League", primaryColor: "#1C5598", social: [] });
    expect(demo.url).toMatch(/^https?:\/\/demo\./);
  });

  it("emails come from the league via the app, with replies to the league", async () => {
    tenant.orgId = DEMO;
    process.env.SMTP_FROM = "LeagueKeep <mail@leaguekeep.test>";
    expect(await senderFor()).toEqual({ from: '"Demo League via LeagueKeep" <mail@leaguekeep.test>', replyTo: "office@demo-league.example.com" });
    expect(await senderFor("captain@example.com")).toMatchObject({ replyTo: "captain@example.com" });
    const mail = await loginLinkEmail({ firstName: "Maya", url: "http://demo.app.localhost:3000/login/link?token=x" });
    expect(mail.subject).toBe("Your Demo League login link");
    expect(mail.html).toContain("#1C5598");
    expect(`${mail.text}${mail.html}`).not.toMatch(/NVASA|nvasa\.org/);
    tenant.orgId = NVASA;
    expect((await senderFor()).from).toBe('"NVASA via LeagueKeep" <mail@leaguekeep.test>');
    delete process.env.SMTP_FROM;
  });

  it("old .cfm links redirect for NVASA only", async () => {
    const req = (host: string) => new NextRequest(`http://${host}/team.cfm?teamid=1`);
    tenant.orgId = NVASA;
    const res = await teamCfm.GET(req("nvasa.app.localhost"));
    expect(res.status).toBe(301);
    // To NVASA's own address, not the server's host name
    expect(new URL(res.headers.get("location")!).hostname).toMatch(/^nvasa\./);
    tenant.orgId = DEMO;
    expect((await teamCfm.GET(req("demo.app.localhost"))).status).toBe(404);
  });

  it("the League profile saves this league only, and only for its owner or admins", async () => {
    tenant.orgId = DEMO;
    const nvBefore = await raw.organization.findUniqueOrThrow({ where: { id: NVASA } });
    auth.user = users.maya;
    expect(await updateLeagueProfile(profile())).toMatchObject({ ok: false, status: 403 });
    auth.user = users.nvasaAdmin;
    expect(await updateLeagueProfile(profile())).toMatchObject({ ok: false, status: 403 });
    auth.user = users.demoOwner;
    expect(await updateLeagueProfile(profile({ primaryColor: "#12;}" }))).toMatchObject({ ok: false, status: 400 });
    expect(await updateLeagueProfile(profile({ facebookUrl: "javascript:alert(1)" }))).toMatchObject({ ok: false, status: 400 });
    expect(await updateLeagueProfile(profile({ fullName: "Itest Demo League" }))).toMatchObject({ ok: true });
    expect(await raw.organization.findUniqueOrThrow({ where: { id: DEMO } })).toMatchObject({ fullName: "Itest Demo League", timezone: "America/Chicago" });
    expect((await raw.organizationSettings.findUniqueOrThrow({ where: { organizationId: DEMO } })).waiverText).toBe("Itest waiver");
    expect((await getBrand()).fullName).toBe("Itest Demo League");
    expect(await raw.organization.findUniqueOrThrow({ where: { id: NVASA } })).toEqual(nvBefore);
  });

  it("Staff: invite, change role and remove; the owner and yourself are protected", async () => {
    tenant.orgId = DEMO;
    auth.user = users.demoOwner;
    expect(await staff.inviteStaff({ email: INVITE, role: "STAFF" })).toMatchObject({ ok: true });
    const m = await raw.organizationMember.findFirstOrThrow({ where: { organizationId: DEMO, user: { email: INVITE } } });
    expect(m).toMatchObject({ role: "STAFF", status: "ACTIVE" });
    expect(await raw.organizationMember.count({ where: { organizationId: NVASA, user: { email: INVITE } } })).toBe(0);
    expect(await raw.verificationToken.count({ where: { identifier: `reset:${m.userId}` } })).toBe(1);
    expect(await staff.inviteStaff({ email: INVITE, role: "STAFF" })).toMatchObject({ ok: false, status: 409 });

    // Staff can look but not manage
    const invited = await raw.user.findUniqueOrThrow({ where: { email: INVITE } });
    auth.user = { id: invited.id, email: INVITE, name: "Itest staff" };
    expect(await staff.inviteStaff({ email: "someone.else@example.com", role: "ADMIN" })).toMatchObject({ ok: false, status: 403 });
    expect(await updateLeagueProfile(profile())).toMatchObject({ ok: false, status: 403 });

    auth.user = users.demoOwner;
    const owner = await raw.organizationMember.findFirstOrThrow({ where: { organizationId: DEMO, role: "OWNER" } });
    expect(await staff.setStaffRole({ memberId: owner.id, role: "STAFF" })).toMatchObject({ ok: false, status: 409 });
    expect(await staff.removeStaff({ memberId: owner.id })).toMatchObject({ ok: false, status: 409 });
    expect(await staff.setStaffRole({ memberId: m.id, role: "ADMIN" })).toMatchObject({ ok: true });
    expect((await raw.organizationMember.findUniqueOrThrow({ where: { id: m.id } })).role).toBe("ADMIN");

    // A guessed NVASA membership id isn't in this league
    const nvMember = await raw.organizationMember.findFirstOrThrow({ where: { organizationId: NVASA, role: "PLAYER" } });
    expect(await staff.setStaffRole({ memberId: nvMember.id, role: "ADMIN" })).toMatchObject({ ok: false, status: 404 });
    expect(await staff.removeStaff({ memberId: nvMember.id })).toMatchObject({ ok: false, status: 404 });
    expect((await raw.organizationMember.findUniqueOrThrow({ where: { id: nvMember.id } })).role).toBe("PLAYER");

    expect(await staff.removeStaff({ memberId: m.id })).toMatchObject({ ok: true });
    expect(await raw.organizationMember.findUniqueOrThrow({ where: { id: m.id } })).toMatchObject({ role: "PLAYER", status: "REMOVED" });
  });
});
