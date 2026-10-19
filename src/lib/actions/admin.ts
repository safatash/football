"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { now } from "@/lib/clock";
import { fullName } from "@/lib/format";
import { normalizeCode } from "@/lib/fees";
import { sendMail } from "@/lib/mail";
import { accountInviteEmail, captainDecisionEmail, placementInfoEmail, reportReminderEmail } from "@/lib/mail-templates";
import { randomBytes } from "node:crypto";
import { checkEligibility } from "@/lib/eligibility";
import { hashPassword } from "@/lib/password";
import { blocklistHit } from "@/lib/queries/registrations";
import { appUrl } from "@/lib/stripe";
import { createToken } from "@/lib/tokens";
import { isAdminEmail } from "@/lib/admin";
import { assertSeasonWritable } from "@/lib/queries/season";
import { syncMatchReportStatus } from "@/lib/reports";
import { ActionError, runAction, type ActionResult } from "./result";
import { assertJerseyFree, requireAdminUser, teamForRoster } from "./admin-guard";

const Id = z.string().trim().min(1).max(64);
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a full date.");

const refreshAdmin = () => revalidatePath("/admin", "layout");

/* ------------------------------------------------------------------ */
/* Registrations & captain requests                                    */
/* ------------------------------------------------------------------ */

/** Sends a denied registration back for review. */
export async function reopenRegistration(input: { registrationId: string }): Promise<ActionResult> {
  return runAction(async () => {
    const { registrationId } = z.object({ registrationId: Id }).parse(input);
    await requireAdminUser();
    const reg = await prisma.registration.findUnique({ where: { id: registrationId } });
    if (!reg) throw new ActionError("Registration not found.", 404);
    await assertSeasonWritable(reg.seasonId);
    if (reg.status !== "REJECTED") throw new ActionError("Only denied registrations can be reopened.", 409);
    await prisma.$transaction([
      prisma.registration.update({
        where: { id: reg.id },
        data: { status: reg.paymentStatus === "PAID" ? "PENDING" : "SUBMITTED", rejectedAt: null, deniedReason: null, deniedMessage: null },
      }),
      prisma.player.update({ where: { id: reg.playerId }, data: { finalApproval: "NEEDS_REVIEW" } }),
    ]);
    refreshAdmin();
    return { ok: true, message: "Reopened for review" };
  });
}

/** Approving gives captain access on that team only (the player must be on its season roster). */
export async function decideCaptainRequest(input: { requestId: string; approve: boolean }): Promise<ActionResult> {
  return runAction(async () => {
    const data = z.object({ requestId: Id, approve: z.boolean() }).parse(input);
    const admin = await requireAdminUser();
    const req = await prisma.captainRequest.findUnique({
      where: { id: data.requestId },
      include: { team: { select: { id: true, name: true, seasonId: true } }, player: { select: { id: true, firstName: true, lastName: true, user: { select: { email: true } } } } },
    });
    if (!req) throw new ActionError("Captain request not found.", 404);
    await assertSeasonWritable(req.team.seasonId);
    if (req.status !== "PENDING") throw new ActionError("This request was already decided.", 409);
    const membership = await prisma.teamRoster.findFirst({ where: { playerId: req.playerId, teamId: req.teamId, leftAt: null, membershipType: "SEASONAL" } });
    if (data.approve && !membership) throw new ActionError(`${fullName(req.player)} isn’t on ${req.team.name}’s roster yet. Approve their registration first.`, 409);

    await prisma.$transaction(async (tx) => {
      await tx.captainRequest.update({ where: { id: req.id }, data: { status: data.approve ? "APPROVED" : "DENIED", decidedById: admin.id, decidedAt: now() } });
      if (data.approve && membership) await tx.teamRoster.update({ where: { id: membership.id }, data: { isCaptain: true, captainRequest: true } });
    });
    await sendMail({ to: req.player.user.email, ...captainDecisionEmail({ firstName: req.player.firstName, teamName: req.team.name, approved: data.approve, teamId: req.team.id }) });
    refreshAdmin();
    revalidatePath(`/captain/${req.teamId}`, "layout");
    return { ok: true, message: data.approve ? `${fullName(req.player)} is now a captain of ${req.team.name}` : "Captain request denied" };
  });
}

/** Make or remove captain on one team membership. */
export async function setCaptain(input: { playerId: string; teamId: string; isCaptain: boolean }): Promise<ActionResult> {
  return runAction(async () => {
    const data = z.object({ playerId: Id, teamId: Id, isCaptain: z.boolean() }).parse(input);
    const admin = await requireAdminUser();
    const membership = await prisma.teamRoster.findFirst({
      where: { playerId: data.playerId, teamId: data.teamId, leftAt: null, membershipType: "SEASONAL" },
      include: { team: { select: { name: true, seasonId: true } } },
    });
    if (!membership) throw new ActionError("That player isn’t on this team’s season roster.", 404);
    await assertSeasonWritable(membership.team.seasonId);
    await prisma.$transaction(async (tx) => {
      await tx.teamRoster.update({ where: { id: membership.id }, data: { isCaptain: data.isCaptain } });
      // A direct grant settles any pending request for that team
      if (data.isCaptain) {
        await tx.captainRequest.updateMany({
          where: { playerId: data.playerId, teamId: data.teamId, status: "PENDING" },
          data: { status: "APPROVED", decidedById: admin.id, decidedAt: now() },
        });
      }
    });
    refreshAdmin();
    revalidatePath(`/captain/${data.teamId}`, "layout");
    return { ok: true, message: `${data.isCaptain ? "Captain access granted" : "Captain access removed"} on ${membership.team.name}` };
  });
}

/* ------------------------------------------------------------------ */
/* Placement                                                           */
/* ------------------------------------------------------------------ */

async function placementRegistration(registrationId: string) {
  const reg = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: { player: { select: { id: true, firstName: true, lastName: true, user: { select: { email: true } } } } },
  });
  if (!reg) throw new ActionError("Registration not found.", 404);
  await assertSeasonWritable(reg.seasonId);
  if (reg.status === "REJECTED" || reg.status === "CANCELLED") throw new ActionError("This registration was denied or cancelled.", 409);
  return reg;
}

/**
 * Assigns a placement player to a team: sets the division, adds the season roster row and
 * approves the registration if it was still waiting for review.
 */
export async function assignPlacement(input: { registrationId: string; teamId: string }): Promise<ActionResult> {
  return runAction(async () => {
    const data = z.object({ registrationId: Id, teamId: Id }).parse(input);
    await requireAdminUser();
    const reg = await placementRegistration(data.registrationId);
    const team = await prisma.team.findUnique({ where: { id: data.teamId } });
    if (!team || team.seasonId !== reg.seasonId) throw new ActionError("Pick a team from this season.", 400);

    await prisma.$transaction(async (tx) => {
      const existing = await tx.teamRoster.findFirst({ where: { playerId: reg.playerId, teamId: team.id, membershipType: "SEASONAL", matchId: null } });
      if (existing) await tx.teamRoster.update({ where: { id: existing.id }, data: { leftAt: null } });
      else await tx.teamRoster.create({ data: { playerId: reg.playerId, teamId: team.id, divisionId: team.divisionId, membershipType: "SEASONAL" } });
      await tx.registration.update({
        where: { id: reg.id },
        data: {
          placementState: "ASSIGNED",
          divisionId: team.divisionId,
          preferredTeamId: reg.preferredTeamId ?? team.id,
          ...(reg.status === "SUBMITTED" || reg.status === "PENDING" ? { status: "APPROVED", approvedAt: now() } : {}),
        },
      });
      await tx.player.update({ where: { id: reg.playerId }, data: { finalApproval: "APPROVED" } });
    });
    refreshAdmin();
    return { ok: true, message: `${fullName(reg.player)} assigned to ${team.name}` };
  });
}

export async function waitlistPlacement(input: { registrationId: string }): Promise<ActionResult> {
  return runAction(async () => {
    const { registrationId } = z.object({ registrationId: Id }).parse(input);
    await requireAdminUser();
    const reg = await placementRegistration(registrationId);
    await prisma.registration.update({ where: { id: reg.id }, data: { placementState: "WAITLISTED" } });
    refreshAdmin();
    return { ok: true, message: `${fullName(reg.player)} waitlisted` };
  });
}

/** Emails the player a question and marks the placement "Info requested". */
export async function requestPlacementInfo(input: { registrationId: string; message: string }): Promise<ActionResult> {
  return runAction(async () => {
    const data = z.object({ registrationId: Id, message: z.string().trim().min(1, "Write a message first.").max(2000) }).parse(input);
    const admin = await requireAdminUser();
    const reg = await placementRegistration(data.registrationId);
    await sendMail({ to: reg.player.user.email, replyTo: admin.email, ...placementInfoEmail({ firstName: reg.player.firstName, message: data.message }) });
    await prisma.registration.update({ where: { id: reg.id }, data: { placementState: "INFO_REQUESTED" } });
    refreshAdmin();
    return { ok: true, message: "Request sent" };
  });
}

/* ------------------------------------------------------------------ */
/* Suspensions                                                         */
/* ------------------------------------------------------------------ */

const SuspendInput = z.object({ playerId: Id, reason: z.string().trim().min(1, "Choose a reason.").max(300), until: IsoDate.nullish() });

export async function suspendPlayer(input: z.input<typeof SuspendInput>): Promise<ActionResult<{ note: string }>> {
  return runAction(async () => {
    const data = SuspendInput.parse(input);
    const admin = await requireAdminUser();
    const player = await prisma.player.findUnique({ where: { id: data.playerId }, select: { id: true, firstName: true, lastName: true } });
    if (!player) throw new ActionError("Player not found.", 404);
    const at = now();
    // Eligible again on that date: the suspension ends at the start of it (Eastern)
    const endsAt = data.until ? new Date(`${data.until}T04:00:00Z`) : null;
    if (endsAt && endsAt <= at) throw new ActionError("Pick a date in the future.", 400);
    const untilLabel = data.until ? day(data.until).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "";
    const note = `${data.reason}.${untilLabel ? ` Eligible again ${untilLabel}.` : ""}`;
    await prisma.$transaction([
      prisma.suspension.create({ data: { playerId: player.id, reason: note, startsAt: at, endsAt, createdById: admin.id } }),
      prisma.player.update({ where: { id: player.id }, data: { status: "SUSPENDED" } }),
    ]);
    refreshAdmin();
    revalidatePath("/captain", "layout");
    return { ok: true, message: "Player suspended", data: { note } };
  });
}

export async function liftSuspension(input: { playerId: string }): Promise<ActionResult> {
  return runAction(async () => {
    const { playerId } = z.object({ playerId: Id }).parse(input);
    await requireAdminUser();
    const at = now();
    await prisma.$transaction([
      prisma.suspension.updateMany({ where: { playerId, liftedAt: null, OR: [{ endsAt: null }, { endsAt: { gt: at } }] }, data: { liftedAt: at } }),
      prisma.player.update({ where: { id: playerId }, data: { status: "ACTIVE" } }),
    ]);
    refreshAdmin();
    revalidatePath("/captain", "layout");
    return { ok: true, message: "Suspension lifted" };
  });
}

/* ------------------------------------------------------------------ */
/* Matches: officials, reports                                         */
/* ------------------------------------------------------------------ */

export async function setOfficials(input: { matchId: string; refs: string[] }): Promise<ActionResult> {
  return runAction(async () => {
    const data = z.object({ matchId: Id, refs: z.array(z.string().trim().max(80)).length(3) }).parse(input);
    await requireAdminUser();
    const match = await prisma.match.findUnique({ where: { id: data.matchId } });
    if (!match) throw new ActionError("Match not found.", 404);
    await assertSeasonWritable(match.seasonId);
    const named = data.refs.filter(Boolean);
    if (new Set(named).size !== named.length) throw new ActionError("Each official can only take one role.", 400);
    await prisma.match.update({ where: { id: match.id }, data: { ref1: data.refs[0] || null, ref2: data.refs[1] || null, ref3: data.refs[2] || null } });
    refreshAdmin();
    revalidatePath(`/matches/${match.gameNumber}/print`);
    return { ok: true, message: `Officials saved · ${named.length} of 3 assigned` };
  });
}

/**
 * Confirms a submitted report: it becomes the match result (scores, Completed) and counts in the
 * standings.
 */
export async function confirmReport(input: { matchId: string; teamId: string }): Promise<ActionResult> {
  return runAction(async () => {
    const data = z.object({ matchId: Id, teamId: Id }).parse(input);
    const admin = await requireAdminUser();
    const report = await prisma.matchReport.findUnique({ where: { matchId_teamId: data }, include: { match: true } });
    if (!report) throw new ActionError("Report not found.", 404);
    await assertSeasonWritable(report.match.seasonId);
    if (report.status !== "SUBMITTED") throw new ActionError(report.status === "CONFIRMED" ? "This report is already confirmed." : "Only submitted reports can be confirmed.", 409);
    const at = now();
    await prisma.$transaction(async (tx) => {
      await tx.matchReport.update({ where: { id: report.id }, data: { status: "CONFIRMED", confirmedById: admin.id, confirmedAt: at } });
      await tx.match.update({ where: { id: report.matchId }, data: { homeScore: report.homeScore, awayScore: report.awayScore, status: "COMPLETED" } });
      await syncMatchReportStatus(tx, report.matchId, at);
    });
    refreshAdmin();
    return { ok: true, message: "Report confirmed. Standings updated." };
  });
}

/** Emails a team's captains a reminder to submit their report. */
export async function sendReportReminder(input: { matchId: string; teamId: string }): Promise<ActionResult> {
  return runAction(async () => {
    const data = z.object({ matchId: Id, teamId: Id }).parse(input);
    const admin = await requireAdminUser();
    const match = await prisma.match.findUnique({ where: { id: data.matchId }, select: { gameNumber: true, seasonId: true, homeTeamId: true, awayTeamId: true } });
    if (!match || (match.homeTeamId !== data.teamId && match.awayTeamId !== data.teamId)) throw new ActionError("Match not found.", 404);
    await assertSeasonWritable(match.seasonId);
    const captains = await prisma.teamRoster.findMany({
      where: { teamId: data.teamId, isCaptain: true, leftAt: null, membershipType: "SEASONAL" },
      select: { player: { select: { firstName: true, lastName: true, user: { select: { email: true } } } }, team: { select: { name: true } } },
    });
    if (!captains.length) throw new ActionError("This team doesn’t have a captain to remind.", 409);
    for (const c of captains) {
      await sendMail({ to: c.player.user.email, replyTo: admin.email, ...reportReminderEmail({ firstName: c.player.firstName, teamName: c.team.name, gameNumber: match.gameNumber, teamId: data.teamId }) });
    }
    return { ok: true, message: `Reminder sent to ${captains.map((c) => fullName(c.player)).join(" & ")}` };
  });
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

const Money = z.number().min(0).max(10_000);
const SettingsInput = z.object({
  seasonId: Id,
  divisions: z.array(
    z.object({ id: Id, fee: Money, cutoff: IsoDate.nullish(), menCutoff: IsoDate.nullish(), womenCutoff: IsoDate.nullish() }),
  ),
  gamePassFee: Money,
  fairfaxCountyAllowed: z.boolean(),
});

/** Saves division fees and birth-date cutoffs, the game pass fee and the Fairfax County rule. */
export async function saveSettings(input: z.input<typeof SettingsInput>): Promise<ActionResult> {
  return runAction(async () => {
    const data = SettingsInput.parse(input);
    await requireAdminUser();
    await assertSeasonWritable(data.seasonId);
    const divisions = await prisma.division.findMany({ where: { seasonId: data.seasonId } });
    const byId = new Map(divisions.map((d) => [d.id, d]));
    if (data.divisions.some((d) => !byId.has(d.id))) throw new ActionError("Some divisions aren’t in this season.", 400);

    await prisma.$transaction(async (tx) => {
      for (const d of data.divisions) {
        const div = byId.get(d.id)!;
        const separate = d.menCutoff !== undefined || d.womenCutoff !== undefined;
        const men = separate ? d.menCutoff : d.cutoff;
        const women = separate ? d.womenCutoff : d.cutoff;
        await tx.division.update({
          where: { id: d.id },
          data: {
            registrationFee: d.fee,
            maleBornOnOrBefore: div.genderRule === "WOMEN" ? div.maleBornOnOrBefore : men ? day(men) : null,
            femaleBornOnOrBefore: div.genderRule === "MEN" ? div.femaleBornOnOrBefore : women ? day(women) : null,
          },
        });
      }
      await tx.leagueSettings.upsert({
        where: { seasonId: data.seasonId },
        update: { gamePassFee: data.gamePassFee, fairfaxCountyAllowed: data.fairfaxCountyAllowed },
        create: { seasonId: data.seasonId, gamePassFee: data.gamePassFee, fairfaxCountyAllowed: data.fairfaxCountyAllowed },
      });
    });
    refreshAdmin();
    revalidatePath("/register", "layout");
    revalidatePath("/");
    return { ok: true, message: "Settings saved" };
  });
}

const CodeInput = z
  .object({
    seasonId: Id,
    code: z
      .string()
      .trim()
      .min(3, "Codes need at least 3 characters.")
      .max(30)
      .regex(/^[A-Za-z0-9-]+$/, "Use letters, numbers and dashes."),
    kind: z.enum(["BOARD", "PROMO", "TEAM_PAID"]),
    type: z.enum(["PERCENT", "AMOUNT"]),
    value: z.number().positive("Enter a value above 0.").max(10_000),
    maxUses: z.number().int().positive().nullish(),
    teamId: Id.nullish(),
  })
  .refine((c) => c.type !== "PERCENT" || c.value <= 100, { message: "A percent can’t be more than 100.", path: ["value"] })
  .refine((c) => c.kind !== "TEAM_PAID" || !!c.teamId, { message: "Team-paid codes need a team.", path: ["teamId"] });

export async function createDiscountCode(input: z.input<typeof CodeInput>): Promise<ActionResult> {
  return runAction(async () => {
    const data = CodeInput.parse(input);
    await requireAdminUser();
    await assertSeasonWritable(data.seasonId);
    const code = normalizeCode(data.code);
    if (await prisma.discountCode.findUnique({ where: { code } })) throw new ActionError(`${code} already exists.`, 409);
    if (data.teamId) {
      const team = await prisma.team.findUnique({ where: { id: data.teamId } });
      if (!team || team.seasonId !== data.seasonId) throw new ActionError("Pick a team from this season.", 400);
    }
    await prisma.discountCode.create({
      data: { code, kind: data.kind, type: data.type, value: data.value, maxUses: data.maxUses ?? null, seasonId: data.seasonId, teamId: data.kind === "TEAM_PAID" ? data.teamId : null },
    });
    refreshAdmin();
    return { ok: true, message: `${code} added` };
  });
}

async function seasonCode(id: string) {
  const code = await prisma.discountCode.findUnique({ where: { id } });
  if (!code) throw new ActionError("Code not found.", 404);
  await assertSeasonWritable(code.seasonId);
  return code;
}

export async function setDiscountCodeActive(input: { id: string; active: boolean }): Promise<ActionResult> {
  return runAction(async () => {
    const data = z.object({ id: Id, active: z.boolean() }).parse(input);
    await requireAdminUser();
    const code = await seasonCode(data.id);
    await prisma.discountCode.update({ where: { id: code.id }, data: { active: data.active } });
    refreshAdmin();
    return { ok: true, message: `${code.code} ${data.active ? "turned on" : "turned off"}` };
  });
}

/** Unused codes can be deleted; used ones are turned off instead so past registrations keep them. */
export async function deleteDiscountCode(input: { id: string }): Promise<ActionResult> {
  return runAction(async () => {
    const { id } = z.object({ id: Id }).parse(input);
    await requireAdminUser();
    const code = await seasonCode(id);
    const used = code.uses > 0 || (await prisma.registration.count({ where: { discountCodeId: code.id } })) > 0;
    if (used) throw new ActionError(`${code.code} has been used. Turn it off instead.`, 409);
    await prisma.discountCode.delete({ where: { id: code.id } });
    refreshAdmin();
    return { ok: true, message: `${code.code} deleted` };
  });
}

export async function addAllowedZip(input: { zip: string }): Promise<ActionResult> {
  return runAction(async () => {
    const { zip } = z.object({ zip: z.string().trim().regex(/^\d{5}$/, "Enter a 5-digit ZIP code.") }).parse(input);
    await requireAdminUser();
    const existing = await prisma.allowedZipCode.findUnique({ where: { zipCode: zip } });
    if (existing) throw new ActionError(existing.fairfaxCounty ? `${zip} is in Fairfax County.` : `${zip} is already allowed.`, 409);
    await prisma.allowedZipCode.create({ data: { zipCode: zip, fairfaxCounty: false } });
    refreshAdmin();
    return { ok: true, message: `${zip} added` };
  });
}

export async function removeAllowedZip(input: { zip: string }): Promise<ActionResult> {
  return runAction(async () => {
    const { zip } = z.object({ zip: z.string().trim().regex(/^\d{5}$/) }).parse(input);
    await requireAdminUser();
    const res = await prisma.allowedZipCode.deleteMany({ where: { zipCode: zip, fairfaxCounty: false } });
    if (!res.count) throw new ActionError(`${zip} isn’t on the extra list.`, 404);
    refreshAdmin();
    return { ok: true, message: `${zip} removed` };
  });
}

const BlockEntry = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^(\*@)?[^\s@]+(@[^\s@]+)?\.[^\s@]+$/, "Enter an email address or a domain.")
  .max(254);

export async function addBlock(input: { entry: string; reason?: string }): Promise<ActionResult> {
  return runAction(async () => {
    const data = z.object({ entry: BlockEntry, reason: z.string().trim().max(200).optional() }).parse(input);
    const admin = await requireAdminUser();
    if (await prisma.blocklist.findUnique({ where: { email: data.entry } })) throw new ActionError(`${data.entry} is already blocked.`, 409);
    await prisma.blocklist.create({ data: { email: data.entry, reason: data.reason || null, blockedBy: admin.email } });
    refreshAdmin();
    return { ok: true, message: `${data.entry} blocked` };
  });
}

export async function removeBlock(input: { entry: string }): Promise<ActionResult> {
  return runAction(async () => {
    const { entry } = z.object({ entry: z.string().trim().toLowerCase().max(254) }).parse(input);
    await requireAdminUser();
    const res = await prisma.blocklist.deleteMany({ where: { email: entry } });
    if (!res.count) throw new ActionError(`${entry} isn’t on the blocklist.`, 404);
    refreshAdmin();
    return { ok: true, message: `${entry} removed` };
  });
}

/* ------------------------------------------------------------------ */
/* Players, rosters and league-office access                          */
/* ------------------------------------------------------------------ */

const INVITE_TTL_MS = 7 * 24 * 3600_000;

const NewPlayerInput = z.object({
  firstName: z.string().trim().min(1, "Enter a first name.").max(50),
  lastName: z.string().trim().min(1, "Enter a last name.").max(50),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  dob: IsoDate,
  gender: z.enum(["FEMALE", "MALE", "NON_BINARY"], { message: "Choose a gender." }),
  phone: z
    .string()
    .trim()
    .max(30)
    .refine((v) => !v || v.replace(/\D/g, "").length >= 10, "Enter a 10-digit phone number."),
  zip: z
    .string()
    .trim()
    .refine((v) => !v || /^\d{5}$/.test(v), "Enter a 5-digit ZIP code."),
  position: z.enum(["", "GK", "DEF", "MID", "FWD"]).default(""),
  teamId: Id.nullish(),
  jerseyNumber: z.number().int().min(0).max(99).nullish(),
  sendInvite: z.boolean().default(true),
});

/**
 * Creates a player account on someone's behalf (approved, active). The password is random and
 * unknown to anyone; the player gets an invitation link to choose one. Optionally adds them to a
 * team in the active season.
 */
export async function createPlayerAccount(input: z.input<typeof NewPlayerInput>): Promise<ActionResult<{ playerId: string }>> {
  return runAction(async () => {
    const data = NewPlayerInput.parse(input);
    const admin = await requireAdminUser();
    if (await prisma.user.findFirst({ where: { email: { equals: data.email, mode: "insensitive" } } })) {
      throw new ActionError("That email already has an NVASA account. Search for the player instead.", 409);
    }
    if (await blocklistHit(data.email)) throw new ActionError("That email is on the blocklist.", 409);
    const team = data.teamId ? await teamForRoster(data.teamId) : null;
    if (team) {
      const elig = checkEligibility(team.division, { dob: day(data.dob), gender: data.gender }, team.season.startDate);
      if (!elig.ok) throw new ActionError(`Can’t add to ${team.name} (${team.division.name}): ${elig.reason}.`, 400);
      await assertJerseyFree(team.id, data.jerseyNumber ?? null);
    }
    const zip = data.zip ? await prisma.allowedZipCode.findUnique({ where: { zipCode: data.zip } }) : null;

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: await hashPassword(randomBytes(24).toString("base64url")),
        player: {
          create: {
            firstName: data.firstName,
            lastName: data.lastName,
            gender: data.gender,
            dob: day(data.dob),
            phone: data.phone,
            address: "",
            city: zip?.city ?? "",
            state: "VA",
            zip: data.zip,
            fairfaxCounty: Boolean(zip?.fairfaxCounty),
            position: data.position,
            tshirtSize: "",
            finalApproval: "APPROVED",
            status: "ACTIVE",
            ...(team
              ? { teamMemberships: { create: { teamId: team.id, divisionId: team.divisionId, membershipType: "SEASONAL", jerseyNumber: data.jerseyNumber ?? null } } }
              : {}),
          },
        },
      },
      include: { player: true },
    });

    let invited = false;
    if (data.sendInvite) {
      const token = await createToken("reset", user.id, INVITE_TTL_MS);
      const res = await sendMail({
        to: user.email,
        replyTo: admin.email,
        ...accountInviteEmail({ firstName: data.firstName, url: `${appUrl()}/login/reset?token=${token}`, teamName: team?.name ?? null }),
      });
      invited = res.sent + res.logged > 0;
    }
    refreshAdmin();
    if (team) revalidatePath(`/captain/${team.id}`, "layout");
    return {
      ok: true,
      message: `${data.firstName} ${data.lastName} added${team ? ` to ${team.name}` : ""}${invited ? " · invitation sent" : ""}`,
      data: { playerId: user.player!.id },
    };
  });
}

const RosterAddInput = z.object({ playerId: Id, teamId: Id, jerseyNumber: z.number().int().min(0).max(99).nullish() });

/** Adds an existing player to a team's season roster (also a second team). Checks division eligibility. */
export async function addPlayerToTeam(input: z.input<typeof RosterAddInput>): Promise<ActionResult> {
  return runAction(async () => {
    const data = RosterAddInput.parse(input);
    await requireAdminUser();
    const team = await teamForRoster(data.teamId);
    const player = await prisma.player.findUnique({ where: { id: data.playerId } });
    if (!player) throw new ActionError("Player not found.", 404);
    if (player.status === "INACTIVE") throw new ActionError("This account is inactive.", 409);
    const elig = checkEligibility(team.division, { dob: player.dob, gender: player.gender }, team.season.startDate);
    if (!elig.ok) throw new ActionError(`${fullName(player)} can’t play in ${team.division.name}: ${elig.reason}.`, 400);
    await assertJerseyFree(team.id, data.jerseyNumber ?? null, player.id);

    const existing = await prisma.teamRoster.findFirst({ where: { playerId: player.id, teamId: team.id, membershipType: "SEASONAL", matchId: null } });
    if (existing && !existing.leftAt) throw new ActionError(`${fullName(player)} is already on ${team.name}.`, 409);
    if (existing) {
      await prisma.teamRoster.update({ where: { id: existing.id }, data: { leftAt: null, isCaptain: false, jerseyNumber: data.jerseyNumber ?? existing.jerseyNumber, joinedAt: now() } });
    } else {
      await prisma.teamRoster.create({ data: { playerId: player.id, teamId: team.id, divisionId: team.divisionId, membershipType: "SEASONAL", jerseyNumber: data.jerseyNumber ?? null } });
    }
    if (player.finalApproval !== "APPROVED") await prisma.player.update({ where: { id: player.id }, data: { finalApproval: "APPROVED" } });
    refreshAdmin();
    revalidatePath(`/captain/${team.id}`, "layout");
    return { ok: true, message: `${fullName(player)} added to ${team.name}` };
  });
}

/**
 * Takes a player off a team's season roster: the membership is closed (kept for history), captain
 * access ends, and they leave any draft match roster for upcoming matches. Finalized rosters and
 * reports are left as they are.
 */
export async function removePlayerFromTeam(input: { playerId: string; teamId: string }): Promise<ActionResult> {
  return runAction(async () => {
    const data = z.object({ playerId: Id, teamId: Id }).parse(input);
    await requireAdminUser();
    const team = await teamForRoster(data.teamId);
    const membership = await prisma.teamRoster.findFirst({
      where: { playerId: data.playerId, teamId: team.id, membershipType: "SEASONAL", leftAt: null },
      include: { player: { select: { firstName: true, lastName: true } } },
    });
    if (!membership) throw new ActionError("That player isn’t on this team’s season roster.", 404);
    const at = now();
    await prisma.$transaction([
      prisma.teamRoster.update({ where: { id: membership.id }, data: { leftAt: at, isCaptain: false } }),
      prisma.matchRosterEntry.deleteMany({
        where: { teamRosterId: membership.id, matchRoster: { status: "DRAFT", match: { scheduledAt: { gt: at }, status: "SCHEDULED" } } },
      }),
      prisma.matchAvailability.deleteMany({ where: { teamRosterId: membership.id, match: { scheduledAt: { gt: at } } } }),
      prisma.captainRequest.updateMany({ where: { playerId: data.playerId, teamId: team.id, status: "PENDING" }, data: { status: "DENIED", decidedAt: at } }),
    ]);
    refreshAdmin();
    revalidatePath(`/captain/${team.id}`, "layout");
    return { ok: true, message: `${fullName(membership.player)} removed from ${team.name}` };
  });
}

/**
 * Grants or revokes league-office access (User.role). Addresses in ADMIN_EMAILS stay admins
 * whatever the role, and you can't remove your own access.
 */
export async function setLeagueOfficeAccess(input: { email: string; admin: boolean }): Promise<ActionResult> {
  return runAction(async () => {
    const data = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email address."), admin: z.boolean() }).parse(input);
    const me = await requireAdminUser();
    const user = await prisma.user.findFirst({ where: { email: { equals: data.email, mode: "insensitive" } } });
    if (!user) throw new ActionError(`No NVASA account uses ${data.email}. They need to sign up or be added as a player first.`, 404);
    if (!data.admin && user.id === me.id) throw new ActionError("You can’t remove your own league-office access.", 409);
    if (!data.admin && isAdminEmail(user.email)) {
      throw new ActionError(`${user.email} is listed in ADMIN_EMAILS, so it stays an admin. Remove it from that setting to revoke access.`, 409);
    }
    if ((user.role === "ADMIN") === data.admin) throw new ActionError(data.admin ? `${user.email} already has league-office access.` : `${user.email} isn’t an admin.`, 409);
    await prisma.user.update({ where: { id: user.id }, data: { role: data.admin ? "ADMIN" : "PLAYER" } });
    refreshAdmin();
    return { ok: true, message: data.admin ? `${user.email} can now use the league office` : `League-office access removed for ${user.email}` };
  });
}
