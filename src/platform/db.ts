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
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { Prisma } from "@prisma/client";
import { headers } from "next/headers";
import prisma from "./prisma";
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

function scopedClient(orgId: string) {
  return prisma.$extends({
    name: "league-scope",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!ORG_MODELS.has(model)) return query(args);
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
          return query(a as typeof args);
        },
      },
    },
  });
}
export type ScopedClient = ReturnType<typeof scopedClient>;

const clients = new Map<string, ScopedClient>();
const forOrg = (orgId: string) => {
  let c = clients.get(orgId);
  if (!c) clients.set(orgId, (c = scopedClient(orgId)));
  return c;
};

const fixedOrg = new AsyncLocalStorage<string>();

/** The scoped client for one league, for scripts and the seed (app code uses `db` / `getDb()`). */
export const clientForOrg = (orgId: string) => forOrg(orgId);

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
