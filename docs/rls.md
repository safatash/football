# Phase 2b: Postgres row-level security (prototype)

Status: **prototype, off by default** (`DB_RLS` unset). Applied only to local Postgres and to the
throwaway Neon branch `rls-bench` (project `nvasa`). Neon's `main` branch is untouched.

The scoped Prisma client (`src/platform/db.ts`) already adds `organizationId` to every query. RLS
is a second lock in the database itself: with it on, a query that skips the client's filter (a
raw query with a missing `WHERE`, a bad include, a future bug in the extension) still sees only
the current league's rows, and writes into another league fail.

## What's in the prototype

| Piece | Where |
| --- | --- |
| Policies on every table with an `organizationId` (30 tables today), the `app_tenant` role and its grants | `prisma/rls/rls.sql` |
| Applies the SQL and creates the app's login role from `DATABASE_APP_URL`; refuses non-local hosts | `scripts/rls-local.ts` (`npm run db:rls`) |
| App-role Prisma client, `rlsEnabled()` | `src/platform/prisma.ts` |
| RLS variant of the scoped client | `rlsScopedClient` in `src/platform/db.ts` |
| Tests | `tests/integration/isolation.test.ts` ("row-level security" block, runs when `DB_RLS=on`) |
| Bench | `tests/perf/rls-latency.test.ts` (runs when `RLS_BENCH=1`) |

**Policy** (the same on every league table):

```sql
CREATE POLICY league_isolation ON <table>
  USING ("organizationId" = current_setting('app.org_id', true))
  WITH CHECK ("organizationId" = current_setting('app.org_id', true));
```

Without `app.org_id` the comparison is against NULL (or `''` once a transaction that set it has
ended), so reads return nothing and writes fail. That's what the "raw query without app.org_id
returns nothing" test checks.

**Roles.**

- The table owner (`DATABASE_URL`) isn't subject to RLS (the tables aren't `FORCE ROW LEVEL
  SECURITY`). Migrations, the seed, crons, `src/platform/**` (identity, signup, organizations,
  the Stripe webhook's platform lookups) and `clientForOrg()` keep using it.
- `app_tenant` (NOLOGIN, no BYPASSRLS) holds the privileges on the tables. The app logs in as a member
  of it (`DATABASE_APP_URL`, e.g. `nvasa_app`). With `DB_RLS=on`, `db` / `getDb()` use that
  connection.

**How the client sets the league.** Neon's pooler is pgbouncer in transaction mode, so a
session-level `SET` would carry over to whoever gets the connection next. The client only uses
`set_config('app.org_id', $1, true)`, which is `SET LOCAL` and ends with the transaction:

- one call (`db.team.findMany(...)`, `db.$queryRaw`, including its nested includes): runs as
  `$transaction([set_config, query])`, so Postgres sees `BEGIN; set_config; <query and its
  includes>; COMMIT`;
- `db.$transaction(async (tx) => …)`: an interactive transaction whose first statement is
  `set_config`. An AsyncLocalStorage flag stops the queries inside from opening their own.

Confirmed from the Postgres statement log: each standalone call gets 3 extra statements
(BEGIN, set_config, COMMIT), and each interactive transaction gets 1 (set_config).

**Test results** (Postgres 16 in Docker, seeded):

- `DB_RLS=on`, direct: all 14 integration files pass (114 tests, including the 6 new RLS tests).
- `DB_RLS=on`, through pgbouncer 1.26 in transaction mode (`?pgbouncer=true`): all pass.
- Sanity check: when the client set the wrong `app.org_id`, 4 isolation tests failed. So the
  suite really depends on RLS when it's on.
- `DB_RLS` unset: unchanged (the 6 RLS tests are skipped).

## Latency

Setup: MacBook, Postgres 16 in Docker Desktop, Prisma 6. 200 iterations after 20 warm-up runs per
workload, run as the NVASA league. Each configuration ran twice, interleaved; the table shows the
mean of the two runs. p50 / p95 in milliseconds.

- **direct**: the app connects straight to Postgres.
- **pgbouncer**: through pgbouncer in transaction mode (like Neon's pooler).
- **pgbouncer + 2 ms**: through toxiproxy adding 1 ms each way in front of pgbouncer, as a rough
  stand-in for a network hop.

### Direct

| Workload | owner p50 | owner p95 | RLS p50 | RLS p95 | Δ p50 |
|---|--:|--:|--:|--:|--:|
| query: team by id (1 row) | 0.6 | 1.1 | 0.8 | 1.1 | +0.2 |
| query: listTeams | 1.7 | 3.1 | 1.9 | 2.3 | +0.2 |
| query: listPlayers | 6.6 | 7.2 | 6.9 | 8.2 | +0.4 |
| query: getPlayer | 3.2 | 3.5 | 3.7 | 4.2 | +0.5 |
| query: getPublicMatch | 2.2 | 2.5 | 2.3 | 2.9 | +0.2 |
| query: standingsByDivision | 1.8 | 2.1 | 2.4 | 2.6 | +0.6 |
| query: seasonLeaders (raw SQL) | 0.4 | 0.5 | 0.8 | 1.0 | +0.4 |
| page: public home (4 queries in parallel) | 11.0 | 14.0 | 11.2 | 12.9 | +0.3 |
| action: updateReferee | 2.1 | 2.5 | 3.4 | 4.2 | +1.3 |
| action: updatePark | 2.1 | 2.7 | 3.5 | 4.1 | +1.4 |
| action: add + remove allowed ZIP | 1.9 | 2.3 | 3.9 | 4.4 | +2.0 |

### Through pgbouncer (transaction mode)

| Workload | owner p50 | owner p95 | RLS p50 | RLS p95 | Δ p50 |
|---|--:|--:|--:|--:|--:|
| query: team by id (1 row) | 1.2 | 1.4 | 1.5 | 1.8 | +0.4 |
| query: listTeams | 3.2 | 3.7 | 3.6 | 4.1 | +0.4 |
| query: listPlayers | 11.4 | 12.7 | 12.1 | 12.9 | +0.7 |
| query: getPlayer | 6.6 | 7.5 | 6.7 | 8.2 | +0.1 |
| query: getPublicMatch | 4.3 | 5.1 | 4.7 | 5.1 | +0.4 |
| query: standingsByDivision | 3.6 | 4.0 | 4.2 | 4.5 | +0.6 |
| query: seasonLeaders (raw SQL) | 1.4 | 1.8 | 2.0 | 2.4 | +0.5 |
| page: public home (4 queries in parallel) | 14.3 | 15.7 | 15.3 | 20.1 | +1.0 |
| action: updateReferee | 4.8 | 5.5 | 6.0 | 6.7 | +1.3 |
| action: updatePark | 4.8 | 5.5 | 5.8 | 6.7 | +1.0 |
| action: add + remove allowed ZIP | 5.7 | 7.3 | 7.5 | 8.3 | +1.8 |

### Through pgbouncer with 2 ms of added round trip

| Workload | owner p50 | owner p95 | RLS p50 | RLS p95 | Δ p50 |
|---|--:|--:|--:|--:|--:|
| query: team by id (1 row) | 22.9 | 27.8 | 32.3 | 39.0 | +9.4 (+41%) |
| query: listTeams | 53.6 | 62.0 | 61.3 | 69.3 | +7.7 (+14%) |
| query: listPlayers | 126.6 | 136.5 | 135.0 | 146.4 | +8.4 (+7%) |
| query: getPlayer | 118.9 | 127.7 | 127.5 | 138.8 | +8.6 (+7%) |
| query: getPublicMatch | 89.3 | 98.0 | 97.9 | 107.8 | +8.6 (+10%) |
| query: standingsByDivision | 52.5 | 58.6 | 61.1 | 68.4 | +8.5 (+16%) |
| query: seasonLeaders (raw SQL) | 24.0 | 29.4 | 34.0 | 38.9 | +9.9 (+41%) |
| page: public home (4 queries in parallel) | 118.4 | 128.2 | 128.3 | 138.7 | +9.9 (+8%) |
| action: updateReferee | 128.8 | 141.6 | 167.0 | 179.9 | +38.2 (+30%) |
| action: updatePark | 127.1 | 140.1 | 166.8 | 181.0 | +39.7 (+31%) |
| action: add + remove allowed ZIP | 164.2 | 178.4 | 211.1 | 226.8 | +46.9 (+29%) |

Don't read the absolute numbers in the last table as a Neon forecast. Toxiproxy delays each
packet in turn, and with `pgbouncer=true` Prisma sends several protocol messages per statement. A
one-row query takes 23 ms there, which is much more than a real 2 ms round trip would cost. The
deltas are what matter.

### What the numbers say

1. **Evaluating the policies costs almost nothing.** Direct, the difference is 0.2–0.6 ms per
   query, and that's the three extra statements, not the `organizationId = current_setting(...)`
   check itself.
2. **The cost is round trips: three per standalone Prisma call, one per interactive
   transaction.** Nested includes run inside the same batch, so `listPlayers` (several SQL
   statements) costs the same extra +8 ms as a one-row lookup. With added latency every
   standalone call pays about +9 ms here. On Neon, expect about **3 × the app↔Neon round trip**
   per call.
3. **Pages barely notice; server actions notice most.** Parallel page queries overlap their
   extra round trips (+8% on the home page). An action makes several standalone calls one after
   another before its transaction: the session's user, membership and guard lookups, then
   loading the row. Each one pays the extra round trips, so actions come out about +30%.
4. **Connections stay busy longer.** A standalone call now holds a pooled connection for four
   exchanges instead of one. That only matters near Neon's pooler limits; there was no queueing
   at the bench's concurrency.

### On Neon (branch `rls-bench`)

Setup: `rls-bench` is a child of `main` in project `nvasa` (aws-us-east-1), on a fixed 0.25 CU
compute like `main`. It has NVASA's data: 62 players, game #204, referees and parks. `prisma/rls/rls.sql`
was applied there by the owner (`neondb_owner`), plus a branch-only `nvasa_app` role with a random
password. Both URLs use Neon's pooler, in the same form as production's `DATABASE_URL`. The bench
ran from this Mac (the opt-in is `RLS_BENCH_HOST` and `RLS_ALLOW_HOST`): 40 iterations after 20
warm-ups, owner and RLS interleaved, two rounds, mean shown. The two rounds agreed within a few ms.

Round trip from this Mac: `SELECT 1` p50 is **13.5 ms** (12.9 through the pooler, 13.9 direct).

Sanity check through the pooler as `nvasa_app`: with no `app.org_id` it sees 0 players; inside a
transaction with `org_nvasa` it sees 62; after `COMMIT` it sees 0 again. So `SET LOCAL` doesn't
leak across pooled connections.

| Workload | owner p50 | owner p95 | RLS p50 | RLS p95 | Δ p50 | Δ in round trips |
|---|--:|--:|--:|--:|--:|--:|
| query: team by id (1 row) | 15.2 | 17.2 | 59.6 | 67.2 | +44.5 | 3.3 |
| query: listTeams | 61.0 | 64.6 | 98.8 | 115.8 | +37.8 | 2.8 |
| query: listPlayers | 170.0 | 182.0 | 212.0 | 234.0 | +42.0 | 3.1 |
| query: getPlayer | 164.4 | 182.3 | 202.9 | 225.1 | +38.4 | 2.8 |
| query: getPublicMatch | 120.4 | 142.1 | 152.3 | 172.7 | +31.9 | 2.4 |
| query: standingsByDivision | 55.1 | 67.0 | 97.6 | 109.1 | +42.5 | 3.1 |
| query: seasonLeaders (raw SQL) | 15.2 | 22.2 | 52.5 | 65.6 | +37.3 | 2.8 |
| page: public home (4 queries in parallel) | 137.1 | 165.3 | 189.4 | 229.2 | +52.4 | 3.9 |
| action: updateReferee | 123.0 | 132.2 | 201.1 | 246.8 | +78.0 | 5.8 |
| action: updatePark | 123.1 | 131.1 | 222.2 | 252.2 | +99.1 | 7.3 |
| action: add + remove allowed ZIP (2 actions) | 109.7 | 115.4 | 260.2 | 300.6 | +150.5 | 11.1 |

This confirms the model: every standalone call costs **about 3 extra round trips**, wherever the
app runs. Actions cost 6–7 (5–6 per action in the ZIP pair) because of their standalone guard
lookups. From this Mac, 13.5 ms per round trip makes that +40 ms per query and +80–100 ms per action.

**Extrapolation to production (not measured).** Vercel functions in the same region as Neon
(us-east-1) usually see a round trip of about 1–2 ms. At that latency, expect:

| | extra p50 |
| --- | --: |
| one standalone query | +3–7 ms |
| public home page (parallel queries) | +4–8 ms |
| one server action | +6–15 ms |

These numbers assume the Vercel project's function region is us-east-1 (iad1). If functions run
in another region, multiply the round-trip count by that region's round trip. To confirm,
measure from a Vercel preview that points at this branch.

**A finding unrelated to RLS:** do not add `pgbouncer=true` to Neon URLs. It turns off
prepared statements, so a `SELECT 1` through the pooler took 73 ms instead of 13 ms. Neon's
pooler supports prepared statements, and production's `DATABASE_URL` correctly leaves the flag
out. (The local pgbouncer runs above used it because that pgbouncer had prepared statements
off, which is why their absolute numbers are higher than "direct".)

## Recommendation

**Adopt RLS, but cut the round trips for actions first, then confirm from a Vercel preview.**

1. *Cut the cost for actions* (small follow-up, the biggest win): run an action's guard and its
   work in one `db.$transaction` (one `set_config`) instead of 4–5 standalone calls. That takes
   an action from +6–7 round trips to about +1. Also, don't wrap calls on models without an
   `organizationId` (`User`, `Organization`). Only do that after checking they don't include
   league rows: under RLS those includes would come back empty. That's safe, but it would break
   pages.
2. *Confirm in the real topology* (needs your go-ahead, because it means adding env vars to
   Vercel): deploy a preview whose `DATABASE_URL` and `DATABASE_APP_URL` point at `rls-bench`,
   set `DB_RLS=on`, and compare preview timings with RLS on and off. Ship if page p95 grows by
   less than 10 ms. The extrapolation above says pages already pass.
3. *Then make it real:* turn `prisma/rls/rls.sql` into a migration and run the one-time role setup
   on `main`: `nvasa_app` with its own password, plus `DATABASE_APP_URL` in Vercel. The owner URL
   stays for migrations, the seed, crons and `src/platform`. CI already runs the integration
   suite a second time with RLS on.

If the preview numbers come back much worse (for example functions in another region from the
database), keep RLS for writes only. Server actions already run in a transaction, so they'd pay
a single extra statement, and reads would rely on the client extension and the raw-client guard
test, as they do today.

## Running it locally

```bash
docker run -d --name nvasa-rls-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=nvasa_rls -p 55440:5432 postgres:16
export DATABASE_URL=postgresql://postgres:postgres@localhost:55440/nvasa_rls
export DATABASE_APP_URL=postgresql://nvasa_app:nvasa_app_local@localhost:55440/nvasa_rls
npx prisma migrate deploy && npx tsx prisma/seed.ts && npm run db:rls
TEST_DATABASE_URL=$DATABASE_URL DB_RLS=on npx vitest run tests/integration
TEST_DATABASE_URL=$DATABASE_URL DB_RLS=on RLS_BENCH=1 RLS_BENCH_OUT=bench.json npx vitest run tests/perf
```

Don't use PGlite for any of this: it connects as a superuser, which skips RLS.
For the pooler numbers, put pgbouncer in front of Postgres with `pool_mode = transaction` and add
`?pgbouncer=true` to both URLs. That's needed only for a local pgbouncer with prepared statements
off; leave it out on Neon.

On a throwaway Neon branch (never `main`), with its owner and `nvasa_app` URLs:

```bash
RLS_ALLOW_HOST=<direct host>,<pooler host> DATABASE_URL=<owner url> DATABASE_APP_URL=<nvasa_app url> npm run db:rls
RLS_BENCH=1 RLS_BENCH_HOST=<pooler host> TEST_DATABASE_URL=<owner pooled url> DATABASE_APP_URL=<nvasa_app pooled url> DB_RLS=on npx vitest run tests/perf
```

The integration tests still refuse non-local hosts. They rewrite match-day rows.
