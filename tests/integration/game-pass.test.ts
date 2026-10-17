import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auth, hasDb } from "./setup";

describe.skipIf(!hasDb)("game passes (database)", async () => {
  const { default: prisma } = await import("@/lib/prisma");
  const { checkGamePassPurchase, expireGamePasses, fulfillGamePass, GamePassError } = await import("@/lib/game-pass-server");
  const { matchPool } = await import("@/lib/queries/teams");

  const ids = {} as Record<string, string>;
  const sessionId = "cs_test_integration_pass";

  beforeAll(async () => {
    auth.user = null;
    const season = await prisma.season.findFirstOrThrow({ where: { isActive: true } });
    const match = (n: number) => prisma.match.findUniqueOrThrow({ where: { seasonId_gameNumber: { seasonId: season.id, gameNumber: n } } });
    const [m208, m202] = [await match(208), await match(202)];
    ids.m208 = m208.id;
    ids.hrn = m208.awayTeamId;
    ids.m202 = m202.id;
    // A seeded player with no Bloodline / Herndon membership
    const player = await prisma.player.findFirstOrThrow({ where: { user: { email: "hannah.cole@example.com" } } });
    ids.player = player.id;
    await cleanup();
  });
  afterAll(cleanup);

  async function cleanup() {
    const passes = await prisma.gamePass.findMany({ where: { playerId: ids.player, matchId: { in: [ids.m208, ids.m202] } }, select: { id: true, paymentId: true } });
    await prisma.teamRoster.deleteMany({ where: { gamePassId: { in: passes.map((p) => p.id) } } });
    await prisma.gamePass.deleteMany({ where: { id: { in: passes.map((p) => p.id) } } });
    await prisma.payment.deleteMany({ where: { id: { in: passes.map((p) => p.paymentId) } } });
  }

  it("rejects a match that has already been played", async () => {
    await expect(checkGamePassPurchase(ids.player, ids.m202, null)).rejects.toBeInstanceOf(GamePassError);
  });

  it("fulfills a paid checkout once, for that match only", async () => {
    const session = { id: sessionId, metadata: { type: "game_pass", matchId: ids.m208, playerId: ids.player, teamId: ids.hrn }, amount_total: 1500, currency: "usd", payment_intent: null };
    const first = await fulfillGamePass(session);
    const again = await fulfillGamePass(session);
    expect(again.id).toBe(first.id);
    expect(await prisma.payment.count({ where: { stripeChargeId: sessionId } })).toBe(1);
    const row = await prisma.teamRoster.findUniqueOrThrow({ where: { gamePassId: first.id } });
    expect(row).toMatchObject({ membershipType: "GAME_PASS", matchId: ids.m208, teamId: ids.hrn });
    expect(await prisma.teamRoster.count({ where: { playerId: ids.player, teamId: ids.hrn, membershipType: "SEASONAL" } })).toBe(0);
    // In Herndon's pool for Game #208, and nowhere else
    expect((await matchPool(ids.hrn, ids.m208)).some((p) => p.player.id === ids.player)).toBe(true);
    expect((await matchPool(ids.hrn, ids.m202)).some((p) => p.player.id === ids.player)).toBe(false);
    await expect(checkGamePassPurchase(ids.player, ids.m208, null)).rejects.toThrow(/already have a game pass/);
  });

  it("expires passes after their window and closes the roster row", async () => {
    const pass = await prisma.gamePass.findFirstOrThrow({ where: { playerId: ids.player, matchId: ids.m208 } });
    const after = new Date(pass.validUntil.getTime() + 60_000);
    expect(await expireGamePasses(new Date(pass.validUntil.getTime() - 60_000), { playerId: ids.player })).toBe(0);
    const n = await expireGamePasses(after, { playerId: ids.player });
    expect(n).toBeGreaterThanOrEqual(1);
    const reread = await prisma.gamePass.findUniqueOrThrow({ where: { id: pass.id }, include: { teamRoster: true } });
    expect(reread.status).toBe("EXPIRED");
    expect(reread.teamRoster?.leftAt?.toISOString()).toBe(pass.validUntil.toISOString());
  });
});
