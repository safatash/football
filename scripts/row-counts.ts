/**
 * Exact row counts for every table, and per organization where the table has organizationId.
 * Used to check migrations lose nothing:  DATABASE_URL=… npx tsx scripts/row-counts.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const tables = await prisma.$queryRawUnsafe<{ table_name: string; has_org: boolean }[]>(
    `SELECT t.table_name,
            EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name = t.table_name AND c.column_name = 'organizationId') AS has_org
       FROM information_schema.tables t
      WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE' AND t.table_name <> '_prisma_migrations'
      ORDER BY t.table_name`,
  );
  const rows: Record<string, string | number> = {};
  for (const t of tables) {
    const [{ n }] = await prisma.$queryRawUnsafe<{ n: number }[]>(`SELECT count(*)::int AS n FROM "${t.table_name}"`);
    if (!t.has_org) {
      rows[t.table_name] = n;
      continue;
    }
    const per = await prisma.$queryRawUnsafe<{ org: string; n: number }[]>(`SELECT "organizationId" AS org, count(*)::int AS n FROM "${t.table_name}" GROUP BY 1 ORDER BY 1`);
    rows[t.table_name] = `${n}${per.length ? ` (${per.map((p) => `${p.org}: ${p.n}`).join(", ")})` : ""}`;
  }
  for (const [k, v] of Object.entries(rows)) console.log(`${k.padEnd(24)} ${v}`);
}

main().finally(() => prisma.$disconnect());
