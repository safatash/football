import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hasDb } from "./setup";

describe.skipIf(!hasDb)("organizations: every row belongs to a league (database)", async () => {
  const { default: prisma } = await import("@/platform/prisma");
  const { NVASA_ORG_ID } = await import("@/lib/org");
  const OTHER = "org_itest_other";

  const cleanup = async () => {
    await prisma.player.deleteMany({ where: { organizationId: OTHER } });
    await prisma.team.deleteMany({ where: { organizationId: OTHER } });
    await prisma.division.deleteMany({ where: { organizationId: OTHER } });
    await prisma.season.deleteMany({ where: { organizationId: OTHER } });
    await prisma.organizationMember.deleteMany({ where: { organizationId: OTHER } });
    await prisma.organization.deleteMany({ where: { id: OTHER } });
  };
  beforeAll(async () => {
    await cleanup();
    await prisma.organization.create({ data: { id: OTHER, name: "Itest League", slug: "itest-league" } });
  });
  afterAll(cleanup);

  it("NVASA exists, is active, and every league row belongs to NVASA or the Demo League", async () => {
    expect(await prisma.organization.findUnique({ where: { id: NVASA_ORG_ID } })).toMatchObject({ slug: "nvasa", status: "ACTIVE", timezone: "America/New_York" });
    const tables = await prisma.$queryRawUnsafe<{ table_name: string }[]>(
      `SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'organizationId' AND table_name NOT IN ('organization_members', 'organization_settings')`,
    );
    expect(tables.length).toBe(27);
    for (const { table_name } of tables) {
      const [{ n }] = await prisma.$queryRawUnsafe<{ n: number }[]>(`SELECT count(*)::int AS n FROM "${table_name}" WHERE "organizationId" NOT IN ('${NVASA_ORG_ID}', 'org_demo', '${OTHER}')`);
      expect(n, table_name).toBe(0);
    }
  });

  it("every user belongs to a league; the operator owns NVASA; league settings carry the Fairfax rule", async () => {
    expect(await prisma.user.count({ where: { memberships: { none: {} } } })).toBe(0);
    const me = await prisma.user.findUniqueOrThrow({ where: { email: "safatash@gmail.com" }, include: { memberships: true } });
    expect(me.isPlatformAdmin).toBe(true);
    expect(me.memberships.find((m) => m.organizationId === NVASA_ORG_ID)).toMatchObject({ role: "OWNER", status: "ACTIVE" });
    expect(await prisma.organizationSettings.findUnique({ where: { organizationId: NVASA_ORG_ID } })).toMatchObject({
      eligibilityMode: "COUNTY_LIST",
      eligibleCounties: ["Fairfax County, VA"],
      pointsWin: 3,
      pointsDraw: 1,
    });
    expect(await prisma.allowedZipCode.count({ where: { county: "Fairfax County, VA" } })).toBeGreaterThan(20);
  });

  it("the same person can have a profile in two leagues, and names repeat across leagues", async () => {
    const maya = await prisma.user.findUniqueOrThrow({ where: { email: "maya.johnson@example.com" } });
    const nv = await prisma.player.findUniqueOrThrow({ where: { userId_organizationId: { userId: maya.id, organizationId: NVASA_ORG_ID } } });
    const other = await prisma.player.create({
      data: { ...pick(nv), id: undefined, organizationId: OTHER, userId: maya.id },
    });
    expect(other.organizationId).toBe(OTHER);
    // Season names are unique per league, not globally
    await prisma.season.create({ data: { organizationId: OTHER, name: "Spring 2026", slug: "spring-2026", startDate: new Date(), endDate: new Date() } });
  });

  it("the database rejects a row in one league pointing at another league's data", async () => {
    const nvDivision = await prisma.division.findFirstOrThrow({ where: { organizationId: NVASA_ORG_ID } });
    const otherSeason = await prisma.season.findFirstOrThrow({ where: { organizationId: OTHER } });
    await expect(
      prisma.team.create({ data: { organizationId: OTHER, seasonId: otherSeason.id, divisionId: nvDivision.id, name: "Itest Crossover" } }),
    ).rejects.toThrow(/foreign key|Foreign key/);
  });
});

/** Profile fields to copy into another league. */
function pick(p: Record<string, unknown>) {
  const { firstName, lastName, gender, dob, phone, address, city, state, zip, position, tshirtSize } = p;
  return { firstName, lastName, gender, dob, phone, address, city, state, zip, position, tshirtSize } as {
    firstName: string; lastName: string; gender: "MALE" | "FEMALE" | "NON_BINARY"; dob: Date; phone: string; address: string; city: string; state: string; zip: string; position: string; tshirtSize: string; id?: undefined;
  };
}
