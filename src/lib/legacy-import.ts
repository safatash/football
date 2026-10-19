/**
 * Import one season of old ColdFusion site data into Postgres. Not wired to anything yet: it's for a
 * future file export (.sql or CSV) of the old data. There's no live-database reader.
 *
 * A reader (fixtures in tests; later, one that parses the export file) supplies plain rows; this module
 * maps and upserts them by legacy id, in order: season → divisions → fields → teams → players +
 * roster → matches → reports and player stats. Re-running it updates the same rows.
 * Passwords are never imported: imported players get an unusable random password and sign in
 * through "Find my player info" or a password reset.
 */
import { randomBytes } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { currentOrgId, playerInOrg } from "@/lib/org";
import { easternTime } from "@/lib/game-pass";
import { legacyPlayerKey } from "@/lib/legacy-redirects";
import { hashPassword } from "@/lib/password";
import { seasonSlug } from "@/lib/public";

/* ------------------------------------------------------------------ */
/* Legacy rows                                                         */
/* ------------------------------------------------------------------ */

type Str = string | null | undefined;
type Num = number | string | null | undefined;

export type LegacySeason = { datasource: string; name: string; startdate: Date | string | null; enddate: Date | string | null; activeSite: Num };
export type LegacyDivision = { id: number; name: string; cat?: Str; orderit?: Num; bbm?: Date | string | null; bbf?: Date | string | null; price?: Num };
export type LegacyField = { id: number; complex: Str; field: Str; address?: Str; city?: Str; state?: Str; zip?: Str };
export type LegacyTeam = { id: number; did: Num; name: string; shortname?: Str; logo?: Str; teamphoto?: Str; htshirt?: Str; hshort?: Str; atshirt?: Str; ashort?: Str; formation?: Str };
export type LegacyPlayer = { id: number; first: Str; last: Str; email?: Str; gender?: Str; position?: Str; photo?: Str; status?: Num; dob?: Date | string | null; phone?: Str };
export type LegacyRoster = { pid: number; tid: number; captain?: Num; finalapproval?: Num; jno?: Num };
export type LegacyGame = { id: number; gameno: Num; did: Num; home: Num; away: Num; gamedate: Date | string | null; gametime: Str; location: Num; scoreHome: Str | number; scoreAway: Str | number; ref?: Num; refl?: Num; refr?: Num };
export type LegacyScore = { pid: number; gid: number; home: Num; away: Num; goal: Num; assist: Num; yellow: Str; yellow2: Str; red: Str; ingame: Str; note: Str };

export interface LegacyReader {
  season(datasource: string): Promise<LegacySeason | null>;
  referees(): Promise<Map<number, string>>;
  divisions(): Promise<LegacyDivision[]>;
  fields(): Promise<LegacyField[]>;
  teams(): Promise<LegacyTeam[]>;
  players(): Promise<LegacyPlayer[]>;
  roster(): Promise<LegacyRoster[]>;
  games(): Promise<LegacyGame[]>;
  scores(): Promise<LegacyScore[]>;
}

/* ------------------------------------------------------------------ */
/* Pure mapping helpers                                                */
/* ------------------------------------------------------------------ */

const int = (v: Num) => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};
const text = (v: Str) => (v ?? "").toString().trim();

/** "rgb(15, 61, 46)", "#0f3d2e", "0F3D2E" → "#0F3D2E"; anything else → null. */
export function toHex(color: Str): string | null {
  const c = text(color);
  if (!c) return null;
  const rgb = c.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
  if (rgb) {
    const parts = rgb.slice(1, 4).map((x) => Math.min(255, Number(x)));
    return `#${parts.map((x) => x.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
  }
  const hex = c.match(/^#?([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (!hex) return null;
  const h = hex[1].length === 3 ? hex[1].split("").map((x) => x + x).join("") : hex[1];
  return `#${h.toUpperCase()}`;
}

/** Free-text kickoff ("8:00 PM", "9am", "13:30") → "HH:MM" (24h), or null. */
export function parseGameTime(t: Str): string | null {
  const m = text(t).toLowerCase().replace(/\./g, "").match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (m[3] === "pm" && h < 12) h += 12;
  if (m[3] === "am" && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** Calendar date from the old data (Date or "yyyy-mm-dd"). */
export function toDay(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  if (d instanceof Date) return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** Kickoff instant in Eastern time; noon if the time is missing so the date stays right. */
export function kickoff(gamedate: LegacyGame["gamedate"], gametime: Str) {
  const day = toDay(gamedate);
  if (!day) return null;
  return easternTime(day, parseGameTime(gametime) ?? "12:00");
}

/** "In" started, "Out" came on, anything else didn't play. */
export const inGame = (v: Str): "IN" | "OUT" | "DNP" => (/^in$/i.test(text(v)) ? "IN" : /^out$/i.test(text(v)) ? "OUT" : "DNP");

/** Scores are strings; '' means not played. */
export function score(v: Str | number): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  return /^\d+$/.test(s) ? Number(s) : null;
}

/** Cards are reason codes ('' = none). Codes go into the note so the reason isn't lost. */
export function cards(s: Pick<LegacyScore, "yellow" | "yellow2" | "red" | "note">) {
  const y = text(s.yellow), y2 = text(s.yellow2), r = text(s.red);
  const codes = [y && `Y ${y}`, y2 && `2Y ${y2}`, r && `R ${r}`].filter(Boolean).join(", ");
  const note = [text(s.note), codes && `Cards: ${codes}`].filter(Boolean).join(" · ");
  return { yellow: y ? 1 : 0, secondYellow: y2 ? 1 : 0, red: r ? 1 : 0, note: note || null };
}

/** Women/Men from the division name; everything else is coed. */
export function genderRuleFor(name: string, cat?: Str): "WOMEN" | "MEN" | "COED" {
  const s = `${name} ${text(cat)}`.toLowerCase();
  if (/\b(women|womens|women's|ladies|female)\b/.test(s)) return "WOMEN";
  if (/\b(men|mens|men's|male)\b/.test(s) && !/coed|co-ed|mixed/.test(s)) return "MEN";
  return "COED";
}

/** Placeholder login for players with no email on file (never deliverable: .invalid). */
export const placeholderEmail = (legacyId: number) => `legacy-player-${legacyId}@nvasa.invalid`;

/* ------------------------------------------------------------------ */
/* Import                                                              */
/* ------------------------------------------------------------------ */

export type ImportOptions = {
  datasource: string;
  dryRun: boolean;
  /** Turns a legacy image filename into a public URL (after copying), or null to skip images. */
  imageUrl?: (kind: "teams" | "team-photos" | "players", file: string) => string | null;
  log?: (msg: string) => void;
};

export type ImportReport = { counts: Record<string, number>; problems: string[] };

export async function importSeason(reader: LegacyReader, db: PrismaClient, opts: ImportOptions): Promise<ImportReport> {
  const log = opts.log ?? (() => {});
  const problems: string[] = [];
  const problem = (p: string) => problems.push(p);

  const legacySeason = await reader.season(opts.datasource);
  if (!legacySeason) throw new Error(`No season with datasource "${opts.datasource}" in nvasa.seasons`);
  const [referees, divisions, fields, teams, players, roster, games, scores] = await Promise.all([
    reader.referees(),
    reader.divisions(),
    reader.fields(),
    reader.teams(),
    reader.players(),
    reader.roster(),
    reader.games(),
    reader.scores(),
  ]);

  // ---------- Validate references before writing anything ----------
  const divIds = new Set(divisions.map((d) => d.id));
  const teamIds = new Set(teams.map((t) => t.id));
  const playerIds = new Set(players.map((p) => p.id));
  const gameIds = new Set(games.map((g) => g.id));
  for (const t of teams) if (!divIds.has(int(t.did) ?? -1)) problem(`team ${t.id} "${t.name}": division ${t.did} not found`);
  for (const r of roster) {
    if (!playerIds.has(r.pid)) problem(`roster: player ${r.pid} not found (team ${r.tid})`);
    if (!teamIds.has(r.tid)) problem(`roster: team ${r.tid} not found (player ${r.pid})`);
  }
  const playable = games.filter((g) => {
    const bad = !teamIds.has(int(g.home) ?? -1) || !teamIds.has(int(g.away) ?? -1) ? "home/away team not found" : !kickoff(g.gamedate, g.gametime) ? `bad date "${g.gamedate}"` : null;
    if (bad) problem(`game ${g.id} (#${g.gameno}): ${bad}`);
    return !bad;
  });
  for (const g of playable) if (!parseGameTime(g.gametime)) problem(`game ${g.id} (#${g.gameno}): kickoff "${g.gametime}" not understood, using noon`);
  const seenNumbers = new Map<number, number>();
  for (const g of playable) {
    const n = int(g.gameno);
    if (n == null || n <= 0) problem(`game ${g.id}: no game number, using ${100000 + g.id}`);
    else if (seenNumbers.has(n)) problem(`game ${g.id}: game number ${n} repeats game ${seenNumbers.get(n)}, using ${100000 + g.id}`);
    else seenNumbers.set(n, g.id);
  }
  const playedIds = new Set(playable.map((g) => g.id));
  for (const s of scores) {
    if (!gameIds.has(s.gid)) problem(`finalscores: game ${s.gid} not found (player ${s.pid})`);
    else if (!playerIds.has(s.pid)) problem(`finalscores: player ${s.pid} not found (game ${s.gid})`);
  }
  for (const p of players) if (!toDay(p.dob)) problem(`player ${p.id} "${text(p.first)} ${text(p.last)}": no date of birth, stored as 1900-01-01`);

  const approvedRoster = roster.filter((r) => int(r.finalapproval) === 1 && playerIds.has(r.pid) && teamIds.has(r.tid));
  const usableScores = scores.filter((s) => playedIds.has(s.gid) && playerIds.has(s.pid) && (int(s.home) || int(s.away)));
  const counts: Record<string, number> = {
    divisions: divisions.length,
    fields: fields.length,
    teams: teams.filter((t) => divIds.has(int(t.did) ?? -1)).length,
    players: players.length,
    rosterSpots: approvedRoster.length,
    matches: playable.length,
    results: playable.filter((g) => score(g.scoreHome) != null && score(g.scoreAway) != null).length,
    playerStatLines: usableScores.length,
  };
  if (opts.dryRun) return { counts, problems };

  // ---------- Season ----------
  const start = toDay(legacySeason.startdate) ?? toDay(games.map((g) => toDay(g.gamedate)).filter(Boolean).sort()[0] ?? null) ?? "2000-01-01";
  const end = toDay(legacySeason.enddate) ?? start;
  const existingSeason = await db.season.findFirst({ where: { OR: [{ legacyDatasource: opts.datasource }, { name: legacySeason.name }] } });
  const seasonData = { name: legacySeason.name, slug: seasonSlug(legacySeason.name), legacyDatasource: opts.datasource, startDate: new Date(`${start}T00:00:00Z`), endDate: new Date(`${end}T00:00:00Z`) };
  // Importing never changes which season is active.
  const season = existingSeason
    ? await db.season.update({ where: { id: existingSeason.id }, data: seasonData })
    : await db.season.create({ data: { ...seasonData, isActive: false } });
  log(`season ${season.name} (${season.slug})`);

  // ---------- Divisions ----------
  const divisionId = new Map<number, string>();
  const usedCodes = new Set((await db.division.findMany({ where: { seasonId: season.id, legacyId: null }, select: { code: true } })).map((d) => d.code));
  for (const d of divisions) {
    const byLegacy = await db.division.findUnique({ where: { seasonId_legacyId: { seasonId: season.id, legacyId: d.id } } });
    const byName = byLegacy ?? (await db.division.findUnique({ where: { seasonId_name: { seasonId: season.id, name: text(d.name) } } }));
    let code = byName?.code ?? seasonSlug(text(d.name)).slice(0, 30);
    if (!byName && usedCodes.has(code)) code = `${code}-${d.id}`;
    usedCodes.add(code);
    const genderRule = genderRuleFor(text(d.name), d.cat);
    const data = {
      name: text(d.name),
      code,
      legacyId: d.id,
      displayOrder: int(d.orderit) ?? 0,
      registrationFee: Number(d.price ?? 0) || 0,
      genderRule,
      level: text(d.cat) || null,
      maleBornOnOrBefore: genderRule === "WOMEN" || !toDay(d.bbm) ? null : new Date(`${toDay(d.bbm)}T00:00:00Z`),
      femaleBornOnOrBefore: genderRule === "MEN" || !toDay(d.bbf) ? null : new Date(`${toDay(d.bbf)}T00:00:00Z`),
    };
    const row = byName ? await db.division.update({ where: { id: byName.id }, data }) : await db.division.create({ data: { ...data, seasonId: season.id } });
    divisionId.set(d.id, row.id);
  }

  // ---------- Fields (shared across seasons) ----------
  const fieldId = new Map<number, string>();
  for (const f of fields) {
    const complex = text(f.complex) || "Field";
    const name = text(f.field) || "1";
    // The address belongs to the park; the first field that has one fills it in
    const address = { address: text(f.address) || null, city: text(f.city) || null, state: text(f.state) || null, zip: text(f.zip) || null };
    const park = await db.park.upsert({ where: { organizationId_name: { organizationId: currentOrgId(), name: complex } }, create: { name: complex, ...address }, update: {} });
    if (!park.address && address.address) await db.park.update({ where: { id: park.id }, data: address });
    const data = { parkId: park.id, name, legacyId: f.id };
    const existing = (await db.field.findUnique({ where: { organizationId_legacyId: { organizationId: currentOrgId(), legacyId: f.id } } })) ?? (await db.field.findUnique({ where: { parkId_name: { parkId: park.id, name } } }));
    const row = existing ? await db.field.update({ where: { id: existing.id }, data }) : await db.field.create({ data });
    fieldId.set(f.id, row.id);
  }

  // ---------- Teams ----------
  const teamId = new Map<number, { id: string; divisionId: string }>();
  for (const t of teams) {
    const div = divisionId.get(int(t.did) ?? -1);
    if (!div) continue;
    const img = (kind: "teams" | "team-photos", file: Str) => (text(file) && opts.imageUrl ? opts.imageUrl(kind, text(file)) : null);
    const data = {
      name: text(t.name),
      shortName: text(t.shortname).slice(0, 4) || null,
      divisionId: div,
      legacyId: t.id,
      logoUrl: img("teams", t.logo),
      photoUrl: img("team-photos", t.teamphoto),
      homeShirt: toHex(t.htshirt),
      homeShorts: toHex(t.hshort),
      awayShirt: toHex(t.atshirt),
      awayShorts: toHex(t.ashort),
      color: toHex(t.htshirt),
      formation: text(t.formation) || null,
    };
    const existing =
      (await db.team.findUnique({ where: { seasonId_legacyId: { seasonId: season.id, legacyId: t.id } } })) ??
      (await db.team.findFirst({ where: { seasonId: season.id, name: { equals: text(t.name), mode: "insensitive" }, legacyId: null } }));
    const row = existing ? await db.team.update({ where: { id: existing.id }, data }) : await db.team.create({ data: { ...data, seasonId: season.id } });
    teamId.set(t.id, { id: row.id, divisionId: div });
  }

  // ---------- Players + roster ----------
  const unusable = await hashPassword(randomBytes(24).toString("base64url"));
  const playerId = new Map<number, string>();
  const approvedIds = new Set(approvedRoster.map((r) => r.pid));
  for (const p of players) {
    const key = legacyPlayerKey(p.id);
    const email = text(p.email).toLowerCase();
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
    let existing = await db.player.findUnique({ where: { organizationId_legacyKey: { organizationId: currentOrgId(), legacyKey: key } }, select: { id: true, userId: true } });
    if (!existing && validEmail) existing = await db.player.findFirst({ where: { user: { email: { equals: validEmail, mode: "insensitive" } } }, select: { id: true, userId: true } });
    const photo = text(p.photo) && opts.imageUrl ? opts.imageUrl("players", text(p.photo)) : null;
    const profile = {
      firstName: text(p.first) || "Player",
      lastName: text(p.last),
      gender: /^f/i.test(text(p.gender)) ? ("FEMALE" as const) : /^m/i.test(text(p.gender)) ? ("MALE" as const) : ("NON_BINARY" as const),
      position: text(p.position),
      legacyKey: key,
      ...(photo ? { photoUrl: photo } : {}),
      ...(approvedIds.has(p.id) ? { finalApproval: "APPROVED" as const } : {}),
    };
    if (existing) {
      await db.player.update({ where: { id: existing.id }, data: profile });
      playerId.set(p.id, existing.id);
      continue;
    }
    const loginEmail = validEmail && !(await db.user.findFirst({ where: { email: { equals: validEmail, mode: "insensitive" } } })) ? validEmail : placeholderEmail(p.id);
    const dob = toDay(p.dob) ?? "1900-01-01";
    const user = await db.user.create({
      data: {
        email: loginEmail,
        password: unusable,
        memberships: { create: { organizationId: currentOrgId(), role: "PLAYER", joinedAt: new Date() } },
        players: {
          create: {
            organizationId: currentOrgId(),
            ...profile,
            dob: new Date(`${dob}T00:00:00Z`),
            phone: text(p.phone),
            address: "",
            city: "",
            state: "VA",
            zip: "",
            tshirtSize: "",
            status: "ACTIVE",
            finalApproval: approvedIds.has(p.id) ? "APPROVED" : "NEEDS_REVIEW",
          },
        },
      },
      include: { players: {
          ...playerInOrg(), select: { id: true } } },
    });
    playerId.set(p.id, user.players[0]!.id);
  }

  for (const r of approvedRoster) {
    const team = teamId.get(r.tid);
    const player = playerId.get(r.pid);
    if (!team || !player) continue;
    const data = { isCaptain: int(r.captain) === 1, jerseyNumber: int(r.jno), leftAt: null };
    const existing = await db.teamRoster.findFirst({ where: { playerId: player, teamId: team.id, membershipType: "SEASONAL", matchId: null } });
    if (existing) await db.teamRoster.update({ where: { id: existing.id }, data });
    else await db.teamRoster.create({ data: { ...data, playerId: player, teamId: team.id, divisionId: team.divisionId, membershipType: "SEASONAL" } });
  }

  // Suspended on the old site (status 2): a suspension for that season
  const seasonEnd = new Date(`${end}T23:59:00Z`);
  for (const p of players.filter((x) => int(x.status) === 2)) {
    const player = playerId.get(p.id);
    if (!player) continue;
    const reason = `Suspended on the old site (${legacySeason.name})`;
    if (!(await db.suspension.findFirst({ where: { playerId: player, reason } }))) {
      await db.suspension.create({ data: { playerId: player, reason, startsAt: new Date(`${start}T00:00:00Z`), endsAt: seasonEnd, createdById: "legacy-import" } });
    }
  }

  // ---------- Matches ----------
  const matchId = new Map<number, string>();
  for (const g of playable) {
    const home = teamId.get(int(g.home)!)!;
    const away = teamId.get(int(g.away)!)!;
    const n = int(g.gameno);
    const gameNumber = n != null && n > 0 && seenNumbers.get(n) === g.id ? n : 100000 + g.id;
    const at = kickoff(g.gamedate, g.gametime)!;
    const h = score(g.scoreHome);
    const a = score(g.scoreAway);
    const played = h != null && a != null;
    const venue = fieldId.get(int(g.location) ?? -1) ?? null;
    const f = venue ? fields.find((x) => x.id === int(g.location)) : null;
    const ref = (id: Num) => (int(id) ? (referees.get(int(id)!) ?? null) : null);
    const data = {
      gameNumber,
      legacyId: g.id,
      divisionId: divisionId.get(int(g.did) ?? -1) ?? home.divisionId,
      homeTeamId: home.id,
      awayTeamId: away.id,
      scheduledAt: at,
      startTime: at,
      endTime: new Date(at.getTime() + 90 * 60_000),
      fieldId: venue,
      field: f ? [text(f.complex), text(f.field)].filter(Boolean).join(" ") : null,
      location: f ? text(f.complex) || null : null,
      homeScore: h,
      awayScore: a,
      status: played ? ("COMPLETED" as const) : ("SCHEDULED" as const),
      // Results on the old site were final once entered
      reportStatus: played ? ("CONFIRMED" as const) : ("NOT_STARTED" as const),
    };
    const existing =
      (await db.match.findUnique({ where: { seasonId_legacyId: { seasonId: season.id, legacyId: g.id } } })) ??
      (await db.match.findUnique({ where: { seasonId_gameNumber: { seasonId: season.id, gameNumber } } }));
    const row = existing ? await db.match.update({ where: { id: existing.id }, data }) : await db.match.create({ data: { ...data, seasonId: season.id } });
    matchId.set(g.id, row.id);
    // Officials: the old site's ref / right AR / left AR, matched to referees by name
    for (const [role, name] of [
      ["CENTER", ref(g.ref)],
      ["AR1", ref(g.refr)],
      ["AR2", ref(g.refl)],
    ] as const) {
      if (!name) continue;
      const official = (await db.referee.findFirst({ where: { name: { equals: name, mode: "insensitive" } } })) ?? (await db.referee.create({ data: { name } }));
      await db.matchOfficial.upsert({
        where: { matchId_role: { matchId: row.id, role } },
        update: { refereeId: official.id },
        create: { matchId: row.id, role, refereeId: official.id, status: played ? "CONFIRMED" : "ASSIGNED" },
      });
    }
  }

  // ---------- Reports + player stats (one confirmed report per team per played game) ----------
  type Line = { goals: number; assists: number; yellow: number; secondYellow: number; red: number; inGame: "IN" | "OUT" | "DNP"; note: string | null };
  const lines = new Map<string, Line>(); // gid|team|pid
  for (const s of usableScores) {
    const legacyTeam = int(s.home) || int(s.away);
    const key = `${s.gid}|${legacyTeam}|${s.pid}`;
    const c = cards(s);
    const prev = lines.get(key);
    const line: Line = {
      goals: (prev?.goals ?? 0) + (int(s.goal) ?? 0),
      assists: (prev?.assists ?? 0) + (int(s.assist) ?? 0),
      yellow: Math.max(prev?.yellow ?? 0, c.yellow),
      secondYellow: Math.max(prev?.secondYellow ?? 0, c.secondYellow),
      red: Math.max(prev?.red ?? 0, c.red),
      inGame: prev?.inGame === "IN" || inGame(s.ingame) === "IN" ? "IN" : prev?.inGame === "OUT" || inGame(s.ingame) === "OUT" ? "OUT" : "DNP",
      note: [prev?.note, c.note].filter(Boolean).join(" · ") || null,
    };
    lines.set(key, line);
  }
  const reportIds = new Map<string, string>();
  for (const g of playable) {
    const h = score(g.scoreHome);
    const a = score(g.scoreAway);
    const match = matchId.get(g.id);
    if (h == null || a == null || !match) continue;
    for (const legacyTeam of [int(g.home)!, int(g.away)!]) {
      const team = teamId.get(legacyTeam)!;
      const data: Prisma.MatchReportUncheckedCreateInput = { matchId: match, teamId: team.id, homeScore: h, awayScore: a, status: "CONFIRMED", confirmedById: "legacy-import", confirmedAt: new Date() };
      const report = await db.matchReport.upsert({
        where: { matchId_teamId: { matchId: match, teamId: team.id } },
        update: { homeScore: h, awayScore: a, status: "CONFIRMED" },
        create: data,
      });
      reportIds.set(`${g.id}|${legacyTeam}`, report.id);
    }
  }
  for (const [key, line] of lines) {
    const [gid, team, pid] = key.split("|").map(Number);
    const reportId = reportIds.get(`${gid}|${team}`);
    const player = playerId.get(pid);
    if (!reportId || !player) continue;
    await db.playerMatchStat.upsert({ where: { reportId_playerId: { reportId, playerId: player } }, update: line, create: { ...line, reportId, playerId: player } });
  }
  log("done");
  return { counts, problems };
}
