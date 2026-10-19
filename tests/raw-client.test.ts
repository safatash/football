/**
 * Guards for league isolation that a type checker can't see:
 *   - only src/platform/** may use the raw Prisma client (everything else goes through the
 *     league-scoped `db` / `getDb()`);
 *   - raw SQL isn't scoped by the client, so every query must filter on "organizationId".
 * Scripts, the seed, migrations and tests may use the raw client.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..");
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
}
const app = files(join(root, "src")).map((p) => ({ path: relative(root, p), src: readFileSync(p, "utf8") }));

describe("raw database access", () => {
  it("only src/platform uses the raw Prisma client", () => {
    const offenders = app
      .filter((f) => !f.path.startsWith("src/platform/"))
      .filter((f) => /new PrismaClient\b|["']@\/platform\/prisma["']|["'][./]*platform\/prisma["']/.test(f.src))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it("app code doesn't import the old raw client module", () => {
    expect(app.filter((f) => /["']@\/lib\/prisma["']/.test(f.src)).map((f) => f.path)).toEqual([]);
  });

  it("every raw SQL query filters by organizationId", () => {
    const offenders: string[] = [];
    let seen = 0;
    for (const f of app.filter((x) => !x.path.startsWith("src/platform/"))) {
      for (const m of f.src.matchAll(/\$(queryRaw|executeRaw)(Unsafe)?\b[\s\S]*?`([\s\S]*?)`/g)) {
        seen++;
        if (m[2] || !/"organizationId"\s*=\s*\$\{/.test(m[3])) offenders.push(`${f.path}: ${m[3].trim().slice(0, 60)}`);
      }
    }
    expect(seen).toBeGreaterThanOrEqual(4); // the stats and standings queries
    expect(offenders).toEqual([]);
  });
});
