/**
 * Applies the row-level-security prototype (prisma/rls/rls.sql) to a LOCAL database and creates the
 * app's login role from DATABASE_APP_URL. Refuses anything that isn't localhost: RLS isn't on Neon
 * yet (see docs/rls.md).
 *   DATABASE_URL=postgresql://postgres:…@localhost:5432/db \
 *   DATABASE_APP_URL=postgresql://nvasa_app:…@localhost:5432/db npm run db:rls
 */
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const LOCAL = ["localhost", "127.0.0.1", "::1", "[::1]"];

function localUrl(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set.`);
  const url = new URL(v);
  if (!LOCAL.includes(url.hostname)) throw new Error(`${name} must point at a local database (got ${url.hostname}). RLS isn't applied to Neon from this script.`);
  return url;
}

async function main() {
  const owner = localUrl("DATABASE_URL");
  const app = localUrl("DATABASE_APP_URL");
  const role = decodeURIComponent(app.username);
  const password = decodeURIComponent(app.password);
  if (!/^[a-z_][a-z0-9_]*$/.test(role)) throw new Error(`Unexpected role name "${role}".`);

  execFileSync("npx", ["prisma", "db", "execute", "--file", "prisma/rls/rls.sql", "--url", owner.toString()], { stdio: "inherit" });

  const prisma = new PrismaClient({ datasourceUrl: owner.toString() });
  try {
    const quoted = `'${password.replace(/'/g, "''")}'`;
    const [{ exists }] = await prisma.$queryRaw<{ exists: boolean }[]>`SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${role}) AS exists`;
    await prisma.$executeRawUnsafe(`${exists ? "ALTER" : "CREATE"} ROLE ${role} LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD ${quoted}`);
    await prisma.$executeRawUnsafe(`GRANT app_tenant TO ${role}`);
    console.log(`RLS policies applied; ${role} logs in as a member of app_tenant. Set DB_RLS=on to use it.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
