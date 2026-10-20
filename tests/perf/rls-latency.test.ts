/**
 * Latency of representative page queries and server actions, for the RLS comparison in
 * docs/rls.md. Skipped unless RLS_BENCH=1; run it once per setup (owner vs DB_RLS=on, direct vs
 * through pgbouncer) and it appends p50/p95 per workload to RLS_BENCH_OUT:
 *   RLS_BENCH=1 RLS_BENCH_LABEL="rls direct" RLS_BENCH_OUT=bench.json DB_RLS=on TEST_DATABASE_URL=… npx vitest run tests/perf
 * On a throwaway Neon branch, also set RLS_BENCH_HOST to its exact host(s). The actions write
 * the same values back, plus audit-log rows.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { describe, it } from "vitest";
import { auth, benchDb } from "../integration/setup";

const NVASA = "org_nvasa";
const ITER = Number(process.env.RLS_BENCH_ITER ?? 200);
const WARMUP = 20;

describe.skipIf(!benchDb || process.env.RLS_BENCH !== "1")("RLS latency bench", async () => {
  const { default: raw } = await import("@/platform/prisma");
  const { db, runWithOrg } = await import("@/lib/db");
  const { listPlayers, getPlayer } = await import("@/lib/queries/players");
  const { listTeams } = await import("@/lib/queries/teams");
  const { listMatches } = await import("@/lib/queries/matches");
  const { getPublicMatch } = await import("@/lib/queries/public");
  const { standingsByDivision, seasonLeaders } = await import("@/lib/queries/standings");
  const refs = await import("@/lib/actions/referees");
  const fields = await import("@/lib/actions/fields");
  const admin = await import("@/lib/actions/admin");

  it("measures", { timeout: 600_000 }, async () => {
    const season = await raw.season.findFirstOrThrow({ where: { organizationId: NVASA, isActive: true } });
    const maya = await raw.player.findFirstOrThrow({ where: { organizationId: NVASA, user: { email: "maya.johnson@example.com" } } });
    const team = await raw.team.findFirstOrThrow({ where: { organizationId: NVASA, seasonId: season.id, code: "ffx" } });
    const ref = await raw.referee.findFirstOrThrow({ where: { organizationId: NVASA } });
    const park = await raw.park.findFirstOrThrow({ where: { organizationId: NVASA } });
    const office = await raw.user.findUniqueOrThrow({ where: { email: "safatash@gmail.com" } });
    auth.user = { id: office.id, email: office.email, name: "NVASA office", isAdmin: true };
    const ok = async (p: Promise<{ ok: boolean }>) => {
      const r = await p;
      if (!r.ok) throw new Error(JSON.stringify(r));
    };

    const workloads: Record<string, () => Promise<unknown>> = {
      "query: team by id (1 row)": () => db.team.findUnique({ where: { id: team.id } }),
      "query: listTeams": () => listTeams(season.id),
      "query: listPlayers": () => listPlayers(season.id),
      "query: getPlayer": () => getPlayer(maya.id, season.id),
      "query: getPublicMatch": () => getPublicMatch("204", season.id),
      "query: standingsByDivision": () => standingsByDivision(season.id),
      "query: seasonLeaders (raw SQL)": () => seasonLeaders(season.id),
      "page: public home (4 queries in parallel)": () => Promise.all([listTeams(season.id), listMatches(season.id), standingsByDivision(season.id), seasonLeaders(season.id)]),
      "action: updateReferee": () => ok(refs.updateReferee({ id: ref.id, name: ref.name, email: ref.email ?? "", phone: ref.phone ?? undefined, certLevel: ref.certLevel ?? undefined, positions: ref.positions, active: ref.active, notes: ref.notes ?? undefined })),
      "action: updatePark": () => ok(fields.updatePark({ id: park.id, name: park.name, address: park.address ?? undefined, city: park.city ?? undefined, state: park.state as "VA", zip: park.zip ?? undefined, mapUrl: park.mapUrl ?? undefined, notes: park.notes ?? undefined })),
      "action: add + remove allowed ZIP": async () => {
        await ok(admin.addAllowedZip({ zip: "20999" }));
        await ok(admin.removeAllowedZip({ zip: "20999" }));
      },
    };

    const pct = (xs: number[], p: number) => xs[Math.min(xs.length - 1, Math.floor((p / 100) * xs.length))];
    const results: Record<string, { p50: number; p95: number; n: number }> = {};
    await runWithOrg(NVASA, async () => {
      for (const [name, run] of Object.entries(workloads)) {
        for (let i = 0; i < WARMUP; i++) await run();
        const ms: number[] = [];
        for (let i = 0; i < ITER; i++) {
          const t = performance.now();
          await run();
          ms.push(performance.now() - t);
        }
        ms.sort((a, b) => a - b);
        results[name] = { p50: +pct(ms, 50).toFixed(2), p95: +pct(ms, 95).toFixed(2), n: ITER };
      }
    });
    auth.user = null;

    const label = process.env.RLS_BENCH_LABEL ?? (process.env.DB_RLS === "on" ? "rls" : "owner");
    console.log(label, results);
    const out = process.env.RLS_BENCH_OUT;
    if (out) {
      const all = existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : {};
      all[label] = results;
      writeFileSync(out, JSON.stringify(all, null, 2));
    }
  });
});
