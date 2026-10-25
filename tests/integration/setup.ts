/**
 * Integration tests run against a seeded database: TEST_DATABASE_URL=postgresql://…@localhost/… npm test
 * They refuse non-local hosts, and they rewrite some match-day rows, so never point them at a real database.
 */
import { beforeAll, vi } from "vitest";

const url = process.env.TEST_DATABASE_URL;
/**
 * The RLS latency bench (tests/perf, RLS_BENCH=1) may also run against a throwaway Neon branch
 * named exactly in RLS_BENCH_HOST. Integration tests still skip there (`hasDb` is false).
 */
let remoteBench = false;
if (url) {
  const host = new URL(url).hostname;
  remoteBench = process.env.RLS_BENCH === "1" && !!process.env.RLS_BENCH_HOST && process.env.RLS_BENCH_HOST.split(",").includes(host);
  if (!["localhost", "127.0.0.1", "::1"].includes(host) && !remoteBench) throw new Error(`TEST_DATABASE_URL must be a local database (got ${host})`);
  process.env.DATABASE_URL = url;
  // Local hosts like nvasa.app.localhost (CI sets the same)
  process.env.APP_ROOT_DOMAIN ||= "app.localhost";
  // View the app as of the seeded match week: Game #204 is tomorrow, #203 was last Sunday.
  process.env.NVASA_NOW = "2026-05-16T12:00:00-04:00";
}

/** The league the code under test runs as (the proxy's x-org-id header in the app). */
export const tenant = { orgId: "org_nvasa" };
// Each test run signs in from its own address, so rate-limit windows from earlier runs don't count
const testIp = `198.51.100.${Math.floor(Math.random() * 250) + 1}-${process.pid}`;
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-org-id": tenant.orgId, "x-forwarded-for": testIp }) }));

export type TestUser = { id: string; email: string; name: string; playerId?: string; isAdmin?: boolean } | null;
export const auth = { user: null as TestUser };

vi.mock("@/lib/session", () => ({
  getSession: async () => (auth.user ? { user: auth.user, expires: "2099-01-01" } : null),
  requireUser: async () => ({ user: auth.user }),
  requireAdmin: async () => ({ user: auth.user }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

export const hasDb = Boolean(url) && !remoteBench;

// Rate-limit windows outlive a test run: start every test file with none (local test database only)
if (hasDb) {
  beforeAll(async () => {
    const { default: raw } = await import("@/platform/prisma");
    // Some unit tests mock the client; there's nothing to clear then
    if (typeof raw?.rateLimit?.deleteMany === "function") await raw.rateLimit.deleteMany({});
  });
}
/** A database for the latency bench: local, or the allowed Neon branch. */
export const benchDb = Boolean(url);
