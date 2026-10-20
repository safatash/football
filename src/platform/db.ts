/**
 * The league-scoped database client. Every query on a league-owned model (anything with an
 * organizationId) is limited to the current league: reads, updates and deletes get
 * `organizationId` added to their `where`, and creates get it set. App code must use this module;
 * the raw client lives in `@/platform/prisma` (see tests/raw-client.test.ts).
 *
 * The current league comes from (in order):
 *   1. `runWithOrg(orgId, fn)` — webhooks, cron jobs, the seed and tests
 *   2. the `x-org-id` request header the proxy sets from the host
 *
 * Not covered by the extension (and handled elsewhere):
 *   - nested writes and includes (composite foreign keys reject cross-league links; nested
 *     includes follow the parent, which is scoped; filter a user's `players` by organizationId)
 *   - raw SQL ($queryRaw): add `"organizationId" = ${orgId}` yourself
 *
 * With `DB_RLS=on`, Postgres row-level security backs all of this up (rlsScopedClient below).
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { Prisma, type PrismaClient } from "@prisma/client";
import { headers } from "next/headers";
import prisma, { appPrisma, rlsEnabled } from "./prisma";
import { ORG_ID_HEADER } from "@/lib/tenant";

/** Models that belong to a league. */
export const ORG_MODELS = new Set(Prisma.dmmf.datamodel.models.filter((m) => m.fields.some((f) => f.name === "organizationId")).map((m) => m.name));

const WHERE_OPS = new Set(["findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow", "findMany", "count", "aggregate", "groupBy", "update", "updateMany", "updateManyAndReturn", "delete", "deleteMany"]);

export class NoOrganizationError extends Error {
  constructor() {
    super("No league for this request. Open the app on a league's address (or use runWithOrg in background jobs).");
  }
}

type Data = Record<string, unknown>;
function withOrg(data: unknown, orgId: string): Data {
  const d = (data ?? {}) as Data;
  if (d.organizationId !== undefined && d.organizationId !== orgId) throw new Error("Refusing to write a row for another league.");
  return { ...d, organizationId: orgId };
}

/** Adds the league to a query's arguments (see the top of this file). */
function scopeArgs(operation: string, args: unknown, orgId: string) {
  const a = { ...((args ?? {}) as Data) };
  if (WHERE_OPS.has(operation)) {
    a.where = { ...((a.where as Data) ?? {}), organizationId: orgId };
    if ((a.data as Data | undefined)?.organizationId !== undefined && (a.data as Data).organizationId !== orgId) throw new Error("Refusing to move a row to another league.");
  } else if (operation === "create") {
    a.data = withOrg(a.data, orgId);
  } else if (operation === "createMany" || operation === "createManyAndReturn") {
    a.data = Array.isArray(a.data) ? a.data.map((d) => withOrg(d, orgId)) : withOrg(a.data, orgId);
  } else if (operation === "upsert") {
    a.where = { ...((a.where as Data) ?? {}), organizationId: orgId };
    a.create = withOrg(a.create, orgId);
  }
  return a;
}

function scopedClient(orgId: string) {
  return prisma.$extends({
    name: "league-scope",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!ORG_MODELS.has(model)) return query(args);
          return query(scopeArgs(operation, args, orgId) as typeof args);
        },
      },
    },
  });
}
export type ScopedClient = ReturnType<typeof scopedClient>;

/** Set while a `$transaction` callback of the RLS client runs: the transaction already has the league. */
const rlsTx = new AsyncLocalStorage<string>();

/** The open league transaction of `leagueTransaction()`: `db` calls for that league join it. */
const ambient = new AsyncLocalStorage<{ orgId: string; tx: unknown }>();
const RUN_IN_TX = Symbol("runInLeagueTransaction");
type TxOptions = { timeout?: number; maxWait?: number };

/**
 * With `DB_RLS=on` (docs/rls.md): the same scoping, on the app role's connection, and every query
 * runs in a transaction that first sets `app.org_id`, the setting the Postgres policies check.
 * `set_config(…, true)` is SET LOCAL, so it ends with the transaction (pgbouncer transaction
 * mode on Neon's pooler hands the connection to someone else afterwards).
 *   - single queries (models and raw SQL): `$transaction([set_config, query])`, one batch;
 *   - `$transaction(fn)`: an interactive transaction that sets it first, then runs `fn`;
 *   - inside `leagueTransaction()`: every call (and `$transaction(fn)`) joins its transaction.
 */
function rlsScopedClient(orgId: string): ScopedClient {
  const base = appPrisma();
  const setOrg = (c: { $executeRaw: PrismaClient["$executeRaw"] }) => c.$executeRaw`SELECT set_config('app.org_id', ${orgId}, true)`;
  const client = base.$extends({
    name: "league-scope-rls",
    query: {
      async $allOperations({ model, operation, args, query }) {
        const a = (model && ORG_MODELS.has(model) ? scopeArgs(operation, args, orgId) : args) as typeof args;
        if (rlsTx.getStore() === orgId) return query(a);
        const [, result] = await base.$transaction([setOrg(base), query(a) as Prisma.PrismaPromise<unknown>]);
        return result;
      },
    },
  });
  const interactive = <T>(fn: (tx: unknown) => Promise<T>, opts?: TxOptions) =>
    client.$transaction(
      (tx) =>
        rlsTx.run(orgId, async () => {
          await setOrg(tx as unknown as PrismaClient);
          return fn(tx);
        }),
      opts,
    ) as Promise<T>;
  const joined = () => {
    const a = ambient.getStore();
    return a?.orgId === orgId ? a.tx : null;
  };
  return new Proxy(client, {
    get(target, prop) {
      if (prop === RUN_IN_TX) return <T>(fn: () => Promise<T>, opts?: TxOptions) => interactive((tx) => ambient.run({ orgId, tx }, fn), opts);
      const tx = joined();
      if (prop !== "$transaction") {
        const src = (tx ?? target) as object;
        const v = Reflect.get(src, prop);
        return typeof v === "function" ? v.bind(src) : v;
      }
      return (fn: unknown, opts?: TxOptions) => {
        if (typeof fn !== "function") throw new Error("$transaction needs a callback (the array form isn't supported).");
        // Already in the league transaction: run the callback in it (no nested transactions)
        if (tx) return (fn as (t: unknown) => Promise<unknown>)(tx);
        return interactive(fn as (t: unknown) => Promise<unknown>, opts);
      };
    },
  }) as unknown as ScopedClient;
}

const clients = new Map<string, ScopedClient>();
const forOrg = (orgId: string) => {
  const key = rlsEnabled() ? `rls:${orgId}` : orgId;
  let c = clients.get(key);
  if (!c) clients.set(key, (c = rlsEnabled() ? rlsScopedClient(orgId) : scopedClient(orgId)));
  return c;
};

const ownerClients = new Map<string, ScopedClient>();
const fixedOrg = new AsyncLocalStorage<string>();

/** The scoped client for one league, for scripts and the seed (app code uses `db` / `getDb()`). */
export const clientForOrg = (orgId: string) => {
  // The owner's connection even with DB_RLS=on: scripts and the seed are platform code
  let c = ownerClients.get(orgId);
  if (!c) ownerClients.set(orgId, (c = scopedClient(orgId)));
  return c;
};

/** Runs `fn` as league `orgId` (webhooks, cron jobs, scripts, tests). */
export function runWithOrg<T>(orgId: string, fn: () => T): T {
  return fixedOrg.run(orgId, fn);
}

/** The current league's id. Throws when there is none. */
export async function getOrgId(): Promise<string> {
  const fixed = fixedOrg.getStore();
  if (fixed) return fixed;
  let id: string | null = null;
  try {
    id = (await headers()).get(ORG_ID_HEADER);
  } catch {
    // Not inside a request
  }
  if (!id) throw new NoOrganizationError();
  return id;
}

/** The league-scoped client for this request. */
export async function getDb(): Promise<ScopedClient> {
  return forOrg(await getOrgId());
}

/**
 * Runs `fn` (an action: its guard, row loads and writes) in one league transaction when
 * `DB_RLS=on`, so the league is set once instead of once per query (docs/rls.md). `db` calls and
 * `db.$transaction(cb)` inside join it; an error anywhere rolls all of it back. Keep mail, uploads
 * and Stripe calls outside: they'd hold the connection open (`assertNoLeagueTransaction`).
 * With RLS off, or with no league (the platform host), it just runs `fn`.
 */
export async function leagueTransaction<T>(fn: () => Promise<T>, opts?: TxOptions): Promise<T> {
  if (!rlsEnabled()) return fn();
  let orgId: string;
  try {
    orgId = await getOrgId();
  } catch (e) {
    if (e instanceof NoOrganizationError) return fn();
    throw e;
  }
  if (ambient.getStore()?.orgId === orgId) return fn();
  const run = (forOrg(orgId) as unknown as Record<typeof RUN_IN_TX, <R>(f: () => Promise<R>, o?: TxOptions) => Promise<R>>)[RUN_IN_TX];
  return run(fn, { timeout: 10_000, ...opts });
}

/** Throws (outside production) when called inside `leagueTransaction()`: for external calls. */
export function assertNoLeagueTransaction(what: string) {
  if (!ambient.getStore()) return;
  const msg = `${what} inside a league transaction: run it after the database work (runAction(fn, { transaction: false }) plus leagueTransaction for the database part).`;
  if (process.env.NODE_ENV === "production") console.warn(msg);
  else throw new Error(msg);
}

/**
 * Same client, resolved on each call, so modules can `import { db }` and write `db.team.findMany()`.
 * Use the callback form of `db.$transaction`; the array form can't be supported lazily.
 */
export const db: ScopedClient = new Proxy({} as ScopedClient, {
  get(_, prop: string) {
    if (prop === "then") return undefined;
    if (prop === "$transaction") {
      return async (fn: unknown, opts?: unknown) => {
        if (typeof fn !== "function") throw new Error("db.$transaction needs a callback (the array form isn't supported).");
        return ((await getDb()).$transaction as (f: unknown, o?: unknown) => Promise<unknown>)(fn, opts);
      };
    }
    if (prop.startsWith("$")) {
      return async (...a: unknown[]) => ((await getDb()) as unknown as Record<string, (...x: unknown[]) => unknown>)[prop](...a);
    }
    return new Proxy(
      {},
      {
        get(_m, method: string) {
          return async (args?: unknown) => ((await getDb()) as unknown as Record<string, Record<string, (a?: unknown) => unknown>>)[prop][method](args);
        },
      },
    );
  },
});

/** A scoped client or a transaction from one (what helpers that take `tx` accept). */
export type DbTx = Omit<ScopedClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends" | "$use">;
