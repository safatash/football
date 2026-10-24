/**
 * The raw, unscoped Prisma client. Only the platform layer (this folder), migrations, scripts and
 * tests may import it; app code uses the league-scoped client from `@/lib/db`.
 * tests/raw-client.test.ts fails the build if anything else imports this file.
 */
import { PrismaClient } from "@prisma/client";

const prismaClientSingleton = () => new PrismaClient();

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== "production") globalThis.prismaGlobal = prisma;

/**
 * Row-level security (Phase 2b, behind `DB_RLS=on`; see docs/rls.md): the league-scoped client
 * connects as the app role from DATABASE_APP_URL, which is subject to the policies in
 * migration 20261025000000_rls_writes. This client (the owner) stays for the platform layer, migrations and crons.
 */
export const rlsEnabled = () => process.env.DB_RLS === "on";

let appClient: PrismaClient | undefined;

/** The app-role client (no superuser, no BYPASSRLS). Only for the scoped client in ./db. */
export function appPrisma(): PrismaClient {
  if (appClient) return appClient;
  const url = process.env.DATABASE_APP_URL;
  if (!url) throw new Error("DB_RLS=on needs DATABASE_APP_URL (the app role's connection string).");
  return (appClient = new PrismaClient({ datasourceUrl: url }));
}
