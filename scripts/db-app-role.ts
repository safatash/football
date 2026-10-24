/**
 * Creates (or re-keys) the app's login role for row-level security: a member of `app_tenant`
 * (created with the policies by migration 20261025000000_rls_writes), with no superuser or
 * BYPASSRLS. The role name and password come from DATABASE_APP_URL; DATABASE_URL is the owner.
 *   DATABASE_URL=<owner url> DATABASE_APP_URL=postgresql://nvasa_app:<password>@<host>/<db> npm run db:app-role
 * Non-local hosts need CONFIRM_HOST=<that host>, so a production database is never changed by
 * accident. Then set DATABASE_APP_URL and DB_RLS=on for the app (docs/rls.md).
 */
import { PrismaClient } from "@prisma/client";

const LOCAL = ["localhost", "127.0.0.1", "::1", "[::1]"];
const confirmed = (process.env.CONFIRM_HOST ?? "").split(",").map((h) => h.trim()).filter(Boolean);

function checkedUrl(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set.`);
  const url = new URL(v);
  if (!LOCAL.includes(url.hostname) && !confirmed.includes(url.hostname))
    throw new Error(`${name} points at ${url.hostname}. Set CONFIRM_HOST=${url.hostname} if you mean to change that database.`);
  return url;
}

async function main() {
  const owner = checkedUrl("DATABASE_URL");
  const app = checkedUrl("DATABASE_APP_URL");
  const role = decodeURIComponent(app.username);
  const password = decodeURIComponent(app.password);
  if (!/^[a-z_][a-z0-9_]*$/.test(role)) throw new Error(`Unexpected role name "${role}".`);
  if (password.length < 16) throw new Error("Use a password of at least 16 characters (e.g. openssl rand -hex 24).");

  const prisma = new PrismaClient({ datasourceUrl: owner.toString() });
  try {
    const [{ tenant }] = await prisma.$queryRaw<{ tenant: boolean }[]>`SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_tenant') AS tenant`;
    if (!tenant) throw new Error("app_tenant doesn't exist: run `prisma migrate deploy` first.");
    const quoted = `'${password.replace(/'/g, "''")}'`;
    const [{ exists }] = await prisma.$queryRaw<{ exists: boolean }[]>`SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${role}) AS exists`;
    // Re-runs only rotate the password: Neon won't let a non-superuser restate NOSUPERUSER
    await prisma.$executeRawUnsafe(exists ? `ALTER ROLE ${role} LOGIN PASSWORD ${quoted}` : `CREATE ROLE ${role} LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD ${quoted}`);
    await prisma.$executeRawUnsafe(`GRANT app_tenant TO ${role}`);
    const [r] = await prisma.$queryRaw<{ rolsuper: boolean; rolbypassrls: boolean }[]>`SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = ${role}`;
    if (r.rolsuper || r.rolbypassrls) throw new Error(`${role} can bypass RLS (superuser or BYPASSRLS); drop it and run this again.`);
    console.log(`${role} is ready (member of app_tenant). Set DATABASE_APP_URL and DB_RLS=on for the app.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
