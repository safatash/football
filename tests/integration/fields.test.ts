import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auth, hasDb, type TestUser } from "./setup";
import { NVASA_ORG_ID, playerInOrg } from "@/lib/org";

describe.skipIf(!hasDb)("parks and fields (database)", async () => {
  // NVASA's rows, through the league-scoped client (the Demo League shares names with NVASA)
  const prisma = (await import("@/platform/db")).clientForOrg("org_nvasa");
  const f = await import("@/lib/actions/fields");
  const { formFields } = await import("@/lib/queries/admin-structure");
  const { getFieldSchedule, listParks } = await import("@/lib/queries/fields");
  const { getPublicMatch } = await import("@/lib/queries/public");
  const { demoSummary } = await import("@/lib/demo");

  let office: TestUser = null;
  let maya: TestUser = null;
  const as = (u: TestUser) => (auth.user = u);
  const ids = {} as Record<string, string>;

  async function cleanup() {
    await prisma.field.deleteMany({ where: { OR: [{ park: { name: { startsWith: "Itest" } } }, { name: { startsWith: "Itest" } }] } });
    await prisma.park.deleteMany({ where: { name: { startsWith: "Itest" } } });
    await prisma.auditLog.deleteMany({ where: { summary: { contains: "Itest" } } });
  }

  beforeAll(async () => {
    await cleanup();
    const a = await prisma.user.findUniqueOrThrow({ where: { email: "safatash@gmail.com" } });
    office = { id: a.id, email: a.email, name: "Office", isAdmin: true };
    const m = await prisma.user.findUniqueOrThrow({ where: { email: "maya.johnson@example.com" }, include: { players: playerInOrg(NVASA_ORG_ID) } });
    maya = { id: m.id, email: m.email, name: "Maya", playerId: m.players[0]!.id };
    const wak = await prisma.park.findUniqueOrThrow({ where: { organizationId_name: { organizationId: NVASA_ORG_ID, name: "Wakefield Park" } } });
    ids.wakefield = wak.id;
    ids.wak3 = (await prisma.field.findUniqueOrThrow({ where: { parkId_name: { parkId: wak.id, name: "3" } } })).id;
  });
  afterAll(async () => {
    await cleanup();
    await prisma.field.update({ where: { id: ids.wak3 }, data: { active: true } });
    await prisma.park.update({ where: { id: ids.wakefield }, data: { address: null, zip: null, mapUrl: null, notes: null } });
  });

  it("existing fields were moved under parks, and the seeded parks are demo data", async () => {
    const parks = await listParks();
    const wak = parks.find((p) => p.name === "Wakefield Park")!;
    expect(wak).toMatchObject({ city: "Annandale", isDemo: true });
    expect(wak.fields.map((x) => x.label)).toEqual(["Field 1", "Field 2", "Field 3"]);
    expect((await demoSummary()).parks).toBe(9);
  });

  it("only the league office can manage fields", async () => {
    as(maya);
    expect(await f.createPark({ name: "Itest Nope", fields: [{ name: "1" }] })).toMatchObject({ ok: false, status: 403 });
    expect(await f.updateField({ id: ids.wak3, parkId: ids.wakefield, name: "3", active: false })).toMatchObject({ ok: false, status: 403 });
    expect(await f.deleteField({ id: ids.wak3 })).toMatchObject({ ok: false, status: 403 });
  });

  it("creates a park with its fields; park names and field names within a park are unique", async () => {
    as(office);
    expect(await f.createPark({ name: "Itest Meadows", city: "Vienna", fields: [{ name: "1" }, { name: "1" }] })).toMatchObject({ ok: false, status: 409 });
    expect(await f.createPark({ name: "Itest Meadows", city: "Vienna", zip: "2218", fields: [{ name: "1" }] })).toMatchObject({ ok: false, status: 400 });
    const res = await f.createPark({ name: "Itest Meadows", address: "1 Park Rd", city: "Vienna", zip: "22180", notes: "Lot B", fields: [{ name: "1", surface: "TURF", lights: true }, { name: "2", size: "SMALL_SIDED" }] });
    expect(res).toMatchObject({ ok: true });
    ids.park = res.ok ? res.data!.id : "";
    expect(await f.createPark({ name: "itest meadows", fields: [{ name: "1" }] })).toMatchObject({ ok: false, status: 409 });
    expect(await f.createField({ parkId: ids.park, name: "2" })).toMatchObject({ ok: false, status: 409, error: expect.stringMatching(/already has Field 2/) });
    // Same field name at another park is fine
    expect(await f.createField({ parkId: ids.wakefield, name: "Itest North" })).toMatchObject({ ok: true });
    const fields = await prisma.field.findMany({ where: { parkId: ids.park }, orderBy: { name: "asc" } });
    expect(fields).toMatchObject([
      { name: "1", surface: "TURF", lights: true, size: "FULL", active: true },
      { name: "2", surface: "GRASS", lights: false, size: "SMALL_SIDED" },
    ]);
  });

  it("refuses to delete a field or park with matches; inactive fields leave the scheduling list but stay on matches", async () => {
    as(office);
    expect(await f.deleteField({ id: ids.wak3 })).toMatchObject({ ok: false, status: 409, error: expect.stringMatching(/Set it to inactive instead/) });
    expect(await f.deletePark({ id: ids.wakefield })).toMatchObject({ ok: false, status: 409 });
    expect(await f.updateField({ id: ids.wak3, parkId: ids.wakefield, name: "3", active: false })).toMatchObject({ ok: true });
    expect((await formFields()).some((x) => x.id === ids.wak3)).toBe(false);
    expect((await formFields(ids.wak3)).find((x) => x.id === ids.wak3)).toMatchObject({ label: "Field 3 (inactive)", park: "Wakefield Park · Annandale" });
    // Game #204 is still at Wakefield Park 3
    const season = await prisma.season.findFirstOrThrow({ where: { isActive: true } });
    const m204 = await prisma.match.findUniqueOrThrow({ where: { seasonId_gameNumber: { seasonId: season.id, gameNumber: 204 } } });
    expect(m204.fieldId).toBe(ids.wak3);
    // An unused field and an unused park can go
    const unused = await prisma.field.findFirstOrThrow({ where: { parkId: ids.park, name: "2" } });
    expect(await f.deleteField({ id: unused.id })).toMatchObject({ ok: true });
    expect(await f.deletePark({ id: ids.park })).toMatchObject({ ok: true });
    expect(await prisma.park.findUnique({ where: { id: ids.park } })).toBeNull();
  });

  it("shows a field's upcoming matches by day, and players see the park address and map link", async () => {
    as(office);
    expect(await f.updatePark({ id: ids.wakefield, name: "Wakefield Park", address: "8100 Braddock Rd", city: "Annandale", state: "VA", zip: "22003", mapUrl: "https://maps.example.test/wakefield", notes: "Park by the tennis courts" })).toMatchObject({ ok: true });
    const sched = (await getFieldSchedule(ids.wak3))!;
    expect(sched.label).toBe("Field 3");
    expect(sched.days.flatMap((d) => d.matches.map((m) => m.gameNumber))).toEqual(expect.arrayContaining([204, 208]));
    const season = await prisma.season.findFirstOrThrow({ where: { isActive: true } });
    const pub = (await getPublicMatch("204", season.id))!;
    expect(pub.venue).toMatchObject({ complex: "Wakefield Park", name: "3", address: "8100 Braddock Rd", zip: "22003", mapUrl: "https://maps.example.test/wakefield", notes: "Park by the tennis courts" });
  });
});
