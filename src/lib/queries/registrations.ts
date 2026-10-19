import type { Prisma, RegistrationStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { currentOrgId } from "@/lib/org";
import { ageOn, checkEligibility } from "@/lib/eligibility";
import { fmtDateOnly, fmtShort, fullName, money, regNumber } from "@/lib/format";
import { getSettings, type SeasonRef } from "./season";
import { listTeams } from "./teams";
import { recommendTeam } from "./placements";

/** A row in the registration tables. */
export type RegListRow = {
  id: string;
  number: string;
  name: string;
  email: string;
  /** Prisma enum; RegistrationBadge maps it */
  status: RegistrationStatus;
  /** Payment enum, or PENDING while a submitted registration hasn't been paid yet */
  payment: string;
  submitted: string;
  submittedAt: number;
  amount: number;
  division: string;
  divisionId: string | null;
  preferred: string;
  captainRequest: boolean;
  needsPlacement: boolean;
  isNew: boolean;
  open: boolean;
};

export const OPEN_STATUSES: RegistrationStatus[] = ["SUBMITTED", "PENDING"];
export const isOpen = (s: RegistrationStatus) => OPEN_STATUSES.includes(s);

/** Legacy selectedTeams / captainRequests: JSON arrays (team ids or names); older rows may be comma-separated. */
export function parseList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const s = raw.trim();
  if (!s) return [];
  try {
    const v: unknown = JSON.parse(s);
    if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
    if (typeof v === "string" || typeof v === "number") return [String(v)];
  } catch {
    /* not JSON */
  }
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

/** A submitted registration hasn't been through checkout yet, so its payment reads as pending. */
export const paymentLabel = (status: RegistrationStatus, payment: string) => (status === "SUBMITTED" && payment === "UNPAID" ? "PENDING" : payment);

type LegacyTeam = { id: string; name: string; division: { id: string; name: string; registrationFee: Prisma.Decimal } };

/** Resolves legacy selectedTeams values (ids or names) to teams in a season. */
async function legacyTeams(seasonId: string, values: string[]) {
  const uniq = [...new Set(values)];
  const map = new Map<string, LegacyTeam>();
  if (!uniq.length) return map;
  const teams = await prisma.team.findMany({
    where: { seasonId, OR: [{ id: { in: uniq } }, { name: { in: uniq } }] },
    select: { id: true, name: true, division: { select: { id: true, name: true, registrationFee: true } } },
  });
  for (const t of teams) {
    map.set(t.id, t);
    if (!map.has(t.name)) map.set(t.name, t);
  }
  return map;
}

const listSelect = {
  id: true,
  number: true,
  status: true,
  paymentStatus: true,
  placementState: true,
  background: true,
  submittedAt: true,
  totalAmount: true,
  selectedTeams: true,
  captainRequests: true,
  captainNote: true,
  division: { select: { id: true, name: true } },
  preferredTeam: { select: { id: true, name: true } },
  player: { select: { firstName: true, lastName: true, user: { select: { email: true } } } },
  captainRequestRows: { select: { status: true } },
} satisfies Prisma.RegistrationSelect;

const NEEDS_PLACEMENT = new Set(["NEW", "INFO_REQUESTED", "WAITLISTED"]);

/** Registrations in a season, newest first. */
export async function listRegistrations(seasonId: string, { openOnly, take }: { openOnly?: boolean; take?: number } = {}) {
  const regs = await prisma.registration.findMany({
    where: { seasonId, ...(openOnly ? { status: { in: OPEN_STATUSES } } : {}) },
    select: listSelect,
    orderBy: [{ submittedAt: "desc" }, { number: "desc" }],
    take,
  });
  const legacy = await legacyTeams(
    seasonId,
    regs.filter((r) => !r.division || !r.preferredTeam).flatMap((r) => parseList(r.selectedTeams).slice(0, 1)),
  );
  return regs.map<RegListRow>((r) => {
    const first = parseList(r.selectedTeams)[0];
    const fallback = first ? legacy.get(first) : undefined;
    const preferred = r.preferredTeam?.name ?? (r.division ? undefined : (fallback?.name ?? first));
    const captainRequest = r.captainRequestRows.length
      ? r.captainRequestRows.some((c) => c.status === "PENDING")
      : isOpen(r.status) && parseList(r.captainRequests).length > 0;
    return {
      id: r.id,
      number: regNumber(r.number),
      name: fullName(r.player),
      email: r.player.user.email,
      status: r.status,
      payment: paymentLabel(r.status, r.paymentStatus),
      submitted: fmtShort(r.submittedAt),
      submittedAt: r.submittedAt.getTime(),
      amount: Number(r.totalAmount),
      division: r.division?.name ?? fallback?.division.name ?? "—",
      divisionId: r.division?.id ?? fallback?.division.id ?? null,
      preferred: preferred ?? "—",
      captainRequest,
      needsPlacement: NEEDS_PLACEMENT.has(r.placementState),
      isNew: r.background === "NEW",
      open: isOpen(r.status),
    };
  });
}

/** Open (submitted or pending review) registrations in a season and the oldest submission date. */
export async function openRegistrationStats(seasonId: string) {
  const where = { seasonId, status: { in: OPEN_STATUSES } } satisfies Prisma.RegistrationWhereInput;
  const [count, oldest, total] = await Promise.all([
    prisma.registration.count({ where }),
    prisma.registration.findFirst({ where, orderBy: { submittedAt: "asc" }, select: { submittedAt: true } }),
    prisma.registration.count({ where: { seasonId } }),
  ]);
  return { count, oldest: oldest ? fmtShort(oldest.submittedAt) : "", total };
}

/** Pending captain requests for teams in a season. */
export async function openCaptainRequests(seasonId: string) {
  const rows = await prisma.captainRequest.findMany({
    where: { status: "PENDING", team: { seasonId } },
    select: {
      id: true,
      registrationId: true,
      note: true,
      createdAt: true,
      player: { select: { id: true, firstName: true, lastName: true } },
      team: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({ ...r, name: fullName(r.player) }));
}

/* ---------------- Detail ---------------- */

export type Check = [ok: boolean, text: string];

const GENDER: Record<string, string> = { FEMALE: "Female", MALE: "Male", NON_BINARY: "Non-binary" };

/** Exact email, the bare domain, or *@domain. */
export async function blocklistHit(email: string) {
  const e = email.trim().toLowerCase();
  const domain = e.split("@")[1] ?? "";
  return prisma.blocklist.findFirst({
    where: { email: { in: [e, ...(domain ? [domain, `*@${domain}`, `@${domain}`] : [])], mode: "insensitive" } },
    select: { reason: true },
  });
}

/**
 * Address rule from the league's eligibility mode: NONE (anyone), ZIP_LIST (a listed ZIP), or
 * COUNTY_LIST (an address in one of the league's counties, or an extra listed ZIP).
 * ZIP rows with a county are county lookups; rows without one are extra allowed ZIPs.
 */
export async function zipEligible(seasonId: string, player: { zip: string; county: string | null }) {
  const [settings, zip] = await Promise.all([
    getSettings(seasonId),
    prisma.allowedZipCode.findUnique({ where: { organizationId_zipCode: { organizationId: currentOrgId(), zipCode: player.zip.trim() } }, select: { county: true } }),
  ]);
  if (settings.eligibilityMode === "NONE") return true;
  if (zip && !zip.county) return true;
  if (settings.eligibilityMode === "ZIP_LIST") return false;
  const counties = settings.eligibleCounties;
  return (!!player.county && counties.includes(player.county)) || (!!zip?.county && counties.includes(zip.county));
}

/** Everything the registration review screen needs. Null when the id isn't in this season. */
export async function getRegistrationReview(id: string, season: Pick<SeasonRef, "id" | "name" | "startDate">) {
  const reg = await prisma.registration.findFirst({
    where: { id, seasonId: season.id },
    include: {
      player: { include: { user: { select: { email: true } } } },
      division: true,
      preferredTeam: { select: { id: true, name: true } },
      backupTeam: { select: { id: true, name: true } },
      discountCode: { select: { code: true } },
      captainRequestRows: { select: { id: true, status: true, note: true, createdAt: true, team: { select: { id: true, name: true } } } },
    },
  });
  if (!reg) return null;
  const p = reg.player;
  const email = p.user.email;
  const name = fullName(p);
  const picks = parseList(reg.selectedTeams);
  const legacyCaps = reg.captainRequestRows.length ? [] : parseList(reg.captainRequests);

  const [teams, legacy, blocked, zipOk] = await Promise.all([
    listTeams(season.id),
    legacyTeams(season.id, [...(reg.division && reg.preferredTeam ? [] : picks), ...legacyCaps]),
    blocklistHit(email),
    zipEligible(season.id, p),
  ]);

  const nameOf = (v: string) => legacy.get(v)?.name ?? v;
  const legacyPreferred = picks[0] ? legacy.get(picks[0]) : undefined;
  const division = reg.division ?? (legacyPreferred ? await prisma.division.findUnique({ where: { id: legacyPreferred.division.id } }) : null);
  const preferred = reg.preferredTeam ?? (reg.division ? null : (legacyPreferred ?? null));
  const preferredName = preferred?.name ?? (!reg.division && picks[0] ? nameOf(picks[0]) : "—");
  const backupName = reg.backupTeam?.name ?? (!reg.division && picks[1] ? nameOf(picks[1]) : "—");

  // Checks
  const age = ageOn(p.dob, season.startDate);
  let eligibility: Check;
  if (!division) eligibility = [false, `Age ${age ?? "unknown"} on opening day · no division chosen`];
  else {
    const res = checkEligibility(division, p, season.startDate);
    eligibility = res.ok
      ? [true, `Age ${age ?? "unknown"} on opening day · eligible for ${division.name}`]
      : [false, `Age ${age ?? "unknown"} on opening day · not eligible for ${division.name} (${res.reason.toLowerCase()})`];
  }
  const amount = money(reg.totalAmount);
  const paid = reg.paymentStatus === "PAID";
  const payment = paymentLabel(reg.status, reg.paymentStatus);
  const discount = reg.discountCode ? ` · ${reg.discountCode.code} applied` : "";
  const checks: Check[] = [
    eligibility,
    [zipOk, zipOk ? `ZIP ${p.zip} is in the eligible area` : `ZIP ${p.zip} (${p.city}) is outside the league’s eligible area`],
    blocked ? [false, `Email is on the blocklist${blocked.reason ? ` · ${blocked.reason}` : ""}`] : [true, "Email not on the blocklist"],
    [
      paid,
      paid
        ? `Payment received · ${amount}${discount}`
        : `Payment ${payment === "FAILED" ? "failed" : payment.toLowerCase()} · ${amount} due${discount}`,
    ],
  ];

  const before = reg.amountBeforeDiscount != null ? Number(reg.amountBeforeDiscount) : null;
  const amountText =
    before != null && before > Number(reg.totalAmount) ? `${amount} (${money(before)} before ${reg.discountCode?.code ?? "discount"})` : amount;

  const application: [string, string][] = [
    ["Season", season.name],
    ["Division", division ? `${division.name} · ${money(division.registrationFee)}` : "—"],
    ["Date of birth", fmtDateOnly(p.dob)],
    ["Gender", GENDER[p.gender] ?? p.gender],
    ["Phone", p.phone || "—"],
    ["Home", [p.address, `${p.city}, ${p.state} ${p.zip}`].filter(Boolean).join(", ")],
    ["Background", `${reg.background === "NEW" ? "New to NVASA" : "Returning player"} · ${reg.level || "No level given"}`],
    ["Position", p.position || "—"],
    ["T-shirt", p.tshirtSize || "—"],
    ["Preferred team", preferredName],
    ["Backup team", backupName],
    ["Amount", amountText],
  ];
  if (reg.playerNote) application.push(["Notes", reg.playerNote]);

  // Captain request
  const pendingCaps = reg.captainRequestRows.filter((c) => c.status === "PENDING");
  const capTeams = pendingCaps.length
    ? pendingCaps.map((c) => c.team)
    : isOpen(reg.status)
      ? legacyCaps.map((v) => legacy.get(v) ?? { id: "", name: v })
      : [];
  const captainsOf = capTeams.flatMap((t) => teams.find((x) => x.id === t.id)?.captains ?? []);
  const captain = capTeams.length
    ? {
        teams: capTeams.map((t) => t.name).join(", "),
        note: reg.captainNote ?? pendingCaps.find((c) => c.note)?.note ?? undefined,
        captains: captainsOf.join(", ") || "—",
      }
    : null;

  const denyNote =
    reg.status === "REJECTED"
      ? [reg.deniedReason, reg.deniedMessage ? `Message to player: “${reg.deniedMessage}”` : null].filter(Boolean).join(". ") || "No reason recorded."
      : undefined;

  // Team options: the registration's division first, then the rest of the season
  const groups = new Map<string, { label: string; options: { id: string; name: string; label: string }[] }>();
  const ordered = division ? [...teams.filter((t) => t.division.id === division.id), ...teams.filter((t) => t.division.id !== division.id)] : teams;
  for (const t of ordered) {
    const g = groups.get(t.division.id) ?? { label: t.division.name, options: [] };
    g.options.push({ id: t.id, name: t.name, label: `${t.name} · ${t.rosterSize} players` });
    groups.set(t.division.id, g);
  }
  const rec = !preferred && division ? await recommendTeam(season.id, division.id, p.position) : null;

  return {
    id: reg.id,
    number: regNumber(reg.number),
    name,
    email,
    submitted: fmtShort(reg.submittedAt),
    status: reg.status,
    payment,
    checks,
    application,
    captain,
    pendingCaptainRequests: pendingCaps.map((c) => ({ id: c.id, teamName: c.team.name, note: c.note, requested: fmtShort(c.createdAt) })),
    denyNote,
    decision: {
      id: reg.id,
      name,
      email,
      status: isOpen(reg.status) ? "open" : reg.status === "APPROVED" ? "approved" : reg.status === "REJECTED" ? "denied" : "cancelled",
      payment: payment === "FAILED" ? "failed" : payment.toLowerCase(),
      paid,
      amount,
      divisionName: division?.name ?? null,
      captainRequested: capTeams.length > 0,
      hasPreference: !!preferred,
    } as const,
    teams: [...groups.values()],
    defaultTeamId: (preferred && teams.some((t) => t.id === preferred.id) ? preferred.id : rec?.team.id) ?? "",
  };
}
