/**
 * Import one season from the old ColdFusion site.
 *
 *   npm run import:legacy -- --season spring2026 --dry-run
 *   npm run import:legacy -- --season spring2026 [--images]
 *
 * LEGACY_MYSQL_URL   mysql://user:pass@host:3306 (no database: each season is its own database,
 *                    named by its datasource; seasons and referees come from the `nvasa` database)
 * LEGACY_WWWROOT     old site folder for images (default ~/Documents/nvasa/wwwroot); only read
 * DATABASE_URL       the Postgres to import into. Check it before running without --dry-run.
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import mysql from "mysql2/promise";
import { PrismaClient } from "@prisma/client";
import { importSeason, type LegacyReader } from "../src/lib/legacy-import";

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? (process.argv[i + 1] ?? "") : null;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

/** Lower-cases column names so `scoreHome`/`scorehome` and `teamDiv` quirks don't matter. */
const norm = <T,>(rows: unknown[]) => rows.map((r) => Object.fromEntries(Object.entries(r as object).map(([k, v]) => [k.toLowerCase(), v]))) as T[];

async function mysqlReader(baseUrl: string, datasource: string): Promise<LegacyReader & { close(): Promise<void> }> {
  if (!/^[a-z0-9_]+$/i.test(datasource)) throw new Error("--season must be a datasource name like spring2026");
  const season = await mysql.createConnection({ uri: baseUrl, database: datasource, dateStrings: ["DATE"] });
  const main = await mysql.createConnection({ uri: baseUrl, database: "nvasa", dateStrings: ["DATE"] });
  const q = async <T,>(c: mysql.Connection, sql: string, params: unknown[] = []) => norm<T>((await c.query(sql, params))[0] as unknown[]);
  const pick = <T,>(rows: Record<string, unknown>[], map: (r: Record<string, unknown>) => T) => rows.map(map);
  return {
    async season(ds) {
      const rows = await q<Record<string, unknown>>(main, "SELECT datasource, name, startdate, enddate, activeSite FROM seasons WHERE datasource = ?", [ds]);
      const r = rows[0];
      return r ? { datasource: String(r.datasource), name: String(r.name), startdate: r.startdate as string, enddate: r.enddate as string, activeSite: r.activesite as number } : null;
    },
    async referees() {
      const rows = await q<Record<string, unknown>>(main, "SELECT id, firstname, lastname FROM users WHERE accounttype = 3");
      return new Map(rows.map((r) => [Number(r.id), `${r.firstname ?? ""} ${r.lastname ?? ""}`.trim()]));
    },
    divisions: async () => pick(await q<Record<string, unknown>>(season, "SELECT * FROM divisions"), (r) => ({ id: Number(r.id), name: String(r.name ?? ""), cat: r.cat as string, orderit: r.orderit as number, bbm: r.bbm as string, bbf: r.bbf as string, price: r.price as number })),
    fields: async () => pick(await q<Record<string, unknown>>(season, "SELECT * FROM fields"), (r) => ({ id: Number(r.id), complex: r.complex as string, field: r.field as string, address: r.address as string, city: r.city as string, state: r.state as string, zip: r.zip as string })),
    teams: async () =>
      pick(await q<Record<string, unknown>>(season, "SELECT * FROM teamdiv"), (r) => ({
        id: Number(r.id),
        did: r.did as number,
        name: String(r.name ?? ""),
        shortname: r.shortname as string,
        logo: r.logo as string,
        teamphoto: r.teamphoto as string,
        htshirt: r.htshirt as string,
        hshort: r.hshort as string,
        atshirt: r.atshirt as string,
        ashort: r.ashort as string,
        formation: r.formation as string,
      })),
    async players() {
      // Emails live on teamPlayers; players has the profile
      const [rows, emails] = await Promise.all([q<Record<string, unknown>>(season, "SELECT * FROM players"), q<Record<string, unknown>>(season, "SELECT id, email FROM teamPlayers")]);
      const email = new Map(emails.map((e) => [Number(e.id), e.email as string]));
      return pick(rows, (r) => ({
        id: Number(r.id),
        first: r.first as string,
        last: r.last as string,
        email: (r.email as string) ?? email.get(Number(r.id)),
        gender: r.gender as string,
        position: r.position as string,
        photo: r.photo as string,
        status: r.status as number,
        dob: (r.dob ?? r.birthdate ?? r.dateofbirth ?? null) as string | null,
        phone: (r.phone ?? r.cell ?? null) as string | null,
      }));
    },
    roster: async () => pick(await q<Record<string, unknown>>(season, "SELECT id, tid, captain, finalapproval, jno FROM teamPlayers"), (r) => ({ pid: Number(r.id), tid: Number(r.tid), captain: r.captain as number, finalapproval: r.finalapproval as number, jno: r.jno as number })),
    games: async () =>
      pick(await q<Record<string, unknown>>(season, "SELECT * FROM schedule"), (r) => ({
        id: Number(r.id),
        gameno: r.gameno as number,
        did: r.did as number,
        home: r.home as number,
        away: r.away as number,
        gamedate: r.gamedate as string,
        gametime: r.gametime as string,
        location: r.location as number,
        scoreHome: r.scorehome as string,
        scoreAway: r.scoreaway as string,
        ref: r.ref as number,
        refl: r.refl as number,
        refr: r.refr as number,
      })),
    scores: async () =>
      pick(await q<Record<string, unknown>>(season, "SELECT pid, gid, home, away, goal, assist, yellow, yellow2, red, ingame, note FROM finalscores"), (r) => ({
        pid: Number(r.pid),
        gid: Number(r.gid),
        home: r.home as number,
        away: r.away as number,
        goal: r.goal as number,
        assist: r.assist as number,
        yellow: r.yellow as string,
        yellow2: r.yellow2 as string,
        red: r.red as string,
        ingame: r.ingame as string,
        note: r.note as string,
      })),
    async close() {
      await Promise.all([season.end(), main.end()]);
    },
  };
}

/** Copies a referenced image from the old site into public/legacy and returns its URL. */
function imageCopier(wwwroot: string) {
  const source = { teams: "images/teams", "team-photos": "images/teams/photo", players: "images/players" } as const;
  return (kind: keyof typeof source, file: string) => {
    if (!/^[\w.\- ()]+$/.test(file)) return null; // plain filenames only
    const from = join(wwwroot, source[kind], file);
    if (!existsSync(from)) return null;
    const dir = join(process.cwd(), "public", "legacy", kind);
    mkdirSync(dir, { recursive: true });
    copyFileSync(from, join(dir, file));
    return `/legacy/${kind}/${encodeURIComponent(file)}`;
  };
}

async function main() {
  const datasource = arg("season");
  const dryRun = flag("dry-run");
  if (!datasource) throw new Error("Usage: npm run import:legacy -- --season spring2026 [--dry-run] [--images]");
  const url = process.env.LEGACY_MYSQL_URL;
  if (!url) throw new Error("Set LEGACY_MYSQL_URL (mysql://user:pass@host:3306)");
  const target = (() => {
    try {
      return new URL(process.env.DATABASE_URL ?? "").host;
    } catch {
      return "(DATABASE_URL not set)";
    }
  })();
  console.log(`${dryRun ? "Dry run" : "Importing"} ${datasource} → ${target}`);

  const reader = await mysqlReader(url, datasource);
  const db = new PrismaClient();
  try {
    const wwwroot = process.env.LEGACY_WWWROOT ?? join(homedir(), "Documents/nvasa/wwwroot");
    const report = await importSeason(reader, db, { datasource, dryRun, imageUrl: flag("images") && !dryRun ? imageCopier(wwwroot) : undefined, log: (m) => console.log(`  ${m}`) });
    console.log("Counts:", report.counts);
    console.log(`Mapping problems: ${report.problems.length}`);
    for (const p of report.problems.slice(0, 5)) console.log(`  - ${p}`);
    if (report.problems.length > 5) console.log(`  … and ${report.problems.length - 5} more`);
  } finally {
    await reader.close();
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
