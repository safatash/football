/**
 * Integration tests run against a seeded database: TEST_DATABASE_URL=postgresql://…@localhost/… npm test
 * They refuse non-local hosts, and they rewrite some match-day rows, so never point them at a real database.
 */
import { vi } from "vitest";

const url = process.env.TEST_DATABASE_URL;
if (url) {
  const host = new URL(url).hostname;
  if (!["localhost", "127.0.0.1", "::1"].includes(host)) throw new Error(`TEST_DATABASE_URL must be a local database (got ${host})`);
  process.env.DATABASE_URL = url;
  // View the app as of the seeded match week: Game #204 is tomorrow, #203 was last Sunday.
  process.env.NVASA_NOW = "2026-05-16T12:00:00-04:00";
}

/** The league the code under test runs as (the proxy's x-org-id header in the app). */
export const tenant = { orgId: "org_nvasa" };
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-org-id": tenant.orgId }) }));

export type TestUser = { id: string; email: string; name: string; playerId?: string; isAdmin?: boolean } | null;
export const auth = { user: null as TestUser };

vi.mock("@/lib/session", () => ({
  getSession: async () => (auth.user ? { user: auth.user, expires: "2099-01-01" } : null),
  requireUser: async () => ({ user: auth.user }),
  requireAdmin: async () => ({ user: auth.user }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

export const hasDb = Boolean(url);
