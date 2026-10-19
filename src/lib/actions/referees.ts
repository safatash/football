"use server";

/**
 * Referees and match officials for the league office. Every action checks admin access on the
 * server and writes an audit entry. A referee with assignments can't be deleted (set inactive).
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { audit } from "@/lib/billing";
import { dayKey, fmtDay, fmtTime } from "@/lib/format";
import { sendMail } from "@/lib/mail";
import { refereeScheduleEmail } from "@/lib/mail-templates";
import { ROLE_LABEL, fills, refereeConflicts, type Booking, type Role } from "@/lib/officials";
import { fieldName } from "@/lib/public";
import { assertSeasonWritable } from "@/lib/queries/season";
import { requireAdminUser } from "./admin-guard";
import { ActionError, runAction, type ActionResult } from "./result";

const Id = z.string().trim().min(1).max(64);
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date.");
const RoleEnum = z.enum(["CENTER", "AR1", "AR2", "FOURTH"]);
const Money = z.number().min(0).max(1000);

function refresh() {
  revalidatePath("/admin", "layout");
}

const RefereeInput = z.object({
  name: z.string().trim().min(2, "Enter the referee’s name.").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254).optional().or(z.literal("")),
  phone: z
    .string()
    .trim()
    .max(30)
    .refine((v) => !v || v.replace(/\D/g, "").length >= 10, "Enter a 10-digit phone number.")
    .optional(),
  certLevel: z.string().trim().max(60).optional(),
  certExpires: IsoDate.nullish(),
  positions: z.array(z.enum(["CENTER", "ASSISTANT"])).min(1, "Pick at least one position."),
  active: z.boolean().default(true),
  notes: z.string().trim().max(300).optional(),
});

const refereeData = (r: z.infer<typeof RefereeInput>) => ({
  name: r.name,
  email: r.email || null,
  phone: r.phone || null,
  certLevel: r.certLevel || null,
  certExpires: r.certExpires ? new Date(`${r.certExpires}T00:00:00Z`) : null,
  positions: r.positions,
  active: r.active,
  notes: r.notes || null,
});

async function assertNameFree(name: string, exceptId?: string) {
  const taken = await prisma.referee.findFirst({ where: { name: { equals: name, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) } });
  if (taken) throw new ActionError(`There’s already a referee called ${taken.name}.`, 409);
}

export async function createReferee(input: z.input<typeof RefereeInput>): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const data = RefereeInput.parse(input);
    const admin = await requireAdminUser();
    await assertNameFree(data.name);
    const ref = await prisma.$transaction(async (tx) => {
      const r = await tx.referee.create({ data: refereeData(data) });
      await audit(tx, admin, { action: "referee.created", entityType: "referee", entityId: r.id, summary: `Added referee ${r.name}` });
      return r;
    });
    refresh();
    return { ok: true, message: `${ref.name} added`, data: { id: ref.id } };
  });
}

export async function updateReferee(input: z.input<typeof RefereeInput> & { id: string }): Promise<ActionResult> {
  return runAction(async () => {
    const data = RefereeInput.parse(input);
    const id = Id.parse(input.id);
    const admin = await requireAdminUser();
    if (!(await prisma.referee.findUnique({ where: { id } }))) throw new ActionError("Referee not found.", 404);
    await assertNameFree(data.name, id);
    await prisma.$transaction(async (tx) => {
      await tx.referee.update({ where: { id }, data: refereeData(data) });
      await audit(tx, admin, { action: "referee.updated", entityType: "referee", entityId: id, summary: `Updated referee ${data.name}${data.active ? "" : " (inactive)"}` });
    });
    refresh();
    return { ok: true, message: `${data.name} saved` };
  });
}

/** Deletes a referee who has never been assigned. */
export async function deleteReferee(input: { id: string }): Promise<ActionResult> {
  return runAction(async () => {
    const id = Id.parse(input.id);
    const admin = await requireAdminUser();
    const ref = await prisma.referee.findUnique({ where: { id }, include: { _count: { select: { assignments: true } } } });
    if (!ref) throw new ActionError("Referee not found.", 404);
    const n = ref._count.assignments;
    if (n) throw new ActionError(`${ref.name} has ${n} assignment${n === 1 ? "" : "s"}, so they can’t be deleted. Set them to inactive instead.`, 409);
    await prisma.$transaction(async (tx) => {
      await tx.referee.delete({ where: { id } });
      await audit(tx, admin, { action: "referee.deleted", entityType: "referee", entityId: id, summary: `Deleted referee ${ref.name}` });
    });
    refresh();
    return { ok: true, message: `${ref.name} deleted` };
  });
}

const CrewInput = z.object({
  matchId: Id,
  crew: z
    .array(z.object({ role: RoleEnum, refereeId: Id.nullish(), status: z.enum(["ASSIGNED", "CONFIRMED", "DECLINED", "NO_SHOW"]).default("ASSIGNED"), fee: Money.nullish() }))
    .max(4),
  /** Save even though a referee is double-booked or at another park that day. */
  force: z.boolean().default(false),
});

/**
 * Sets a match's officials, one per role. Only active referees can be newly assigned. Conflicts
 * (overlapping match, another park the same day) come back as a 409 with warnings unless forced.
 * Paid fees stay paid when a slot keeps the same referee.
 */
export async function setMatchOfficials(input: z.input<typeof CrewInput>): Promise<ActionResult<{ open: number }>> {
  return runAction(async () => {
    const data = CrewInput.parse(input);
    const admin = await requireAdminUser();
    const match = await prisma.match.findUnique({
      where: { id: data.matchId },
      include: { officials: true, venue: { include: { park: true } } },
    });
    if (!match) throw new ActionError("Match not found.", 404);
    await assertSeasonWritable(match.seasonId);

    const chosen = data.crew.filter((c) => c.refereeId);
    const ids = chosen.map((c) => c.refereeId!);
    if (new Set(ids).size !== ids.length) throw new ActionError("Each referee can only take one role on a match.", 400);
    const refs = await prisma.referee.findMany({ where: { id: { in: ids } } });
    for (const c of chosen) {
      const r = refs.find((x) => x.id === c.refereeId);
      if (!r) throw new ActionError("Pick referees from the list.", 400);
      const kept = match.officials.some((o) => o.role === c.role && o.refereeId === r.id);
      if (!r.active && !kept) throw new ActionError(`${r.name} is inactive, so they can’t be assigned.`, 400);
    }

    if (!data.force) {
      const day = dayKey(match.scheduledAt);
      const from = new Date(match.scheduledAt.getTime() - 18 * 3600_000);
      const to = new Date(match.scheduledAt.getTime() + 18 * 3600_000);
      const others = await prisma.matchOfficial.findMany({
        where: { refereeId: { in: ids }, matchId: { not: match.id }, status: { not: "DECLINED" }, match: { scheduledAt: { gte: from, lte: to }, status: { not: "CANCELLED" } } },
        include: { match: { select: { id: true, gameNumber: true, scheduledAt: true, venue: { select: { park: { select: { id: true, name: true } } } } } } },
      });
      const here: Booking = { matchId: match.id, gameNumber: match.gameNumber, scheduledAt: match.scheduledAt, parkId: match.venue?.park.id ?? null, parkName: match.venue?.park.name ?? null, dayKey: day };
      const warnings = chosen
        .filter((c) => c.status !== "DECLINED")
        .flatMap((c) => {
          const r = refs.find((x) => x.id === c.refereeId)!;
          const theirs = others
            .filter((o) => o.refereeId === r.id)
            .map((o) => ({ matchId: o.match.id, gameNumber: o.match.gameNumber, scheduledAt: o.match.scheduledAt, parkId: o.match.venue?.park.id ?? null, parkName: o.match.venue?.park.name ?? null, dayKey: dayKey(o.match.scheduledAt) }));
          return refereeConflicts(r.name, here, theirs);
        });
      if (warnings.length) throw new ActionError("Check the referee schedule before saving.", 409, warnings);
    }

    await prisma.$transaction(async (tx) => {
      for (const c of data.crew) {
        const current = match.officials.find((o) => o.role === c.role);
        if (!c.refereeId) {
          if (current) await tx.matchOfficial.delete({ where: { id: current.id } });
          continue;
        }
        const same = current?.refereeId === c.refereeId;
        await tx.matchOfficial.upsert({
          where: { matchId_role: { matchId: match.id, role: c.role } },
          create: { matchId: match.id, role: c.role, refereeId: c.refereeId, status: c.status, fee: c.fee ?? null },
          update: { refereeId: c.refereeId, status: c.status, fee: c.fee ?? null, ...(same ? {} : { paidAt: null }) },
        });
      }
      const names = chosen.map((c) => `${ROLE_LABEL[c.role]} ${refs.find((r) => r.id === c.refereeId)!.name}`);
      await audit(tx, admin, { action: "officials.set", entityType: "match", entityId: match.id, summary: `Game #${match.gameNumber} officials: ${names.join(", ") || "none"}` });
    });
    const after = await prisma.matchOfficial.findMany({ where: { matchId: match.id } });
    const open = (["CENTER", "AR1", "AR2"] as Role[]).filter((r) => !after.some((o) => o.role === r && fills(o))).length;
    refresh();
    revalidatePath(`/matches/${match.gameNumber}/print`);
    return { ok: true, message: `Officials saved${open ? ` · ${open} crew slot${open === 1 ? "" : "s"} still open` : " · full crew"}`, data: { open } };
  });
}

/** Marks assignments paid or unpaid (the pay report's toggle). */
export async function setOfficialsPaid(input: { ids: string[]; paid: boolean }): Promise<ActionResult> {
  return runAction(async () => {
    const data = z.object({ ids: z.array(Id).min(1).max(500), paid: z.boolean() }).parse(input);
    const admin = await requireAdminUser();
    const rows = await prisma.matchOfficial.findMany({ where: { id: { in: data.ids } }, include: { referee: { select: { name: true } } } });
    if (rows.length !== data.ids.length) throw new ActionError("Some assignments weren’t found.", 404);
    await prisma.$transaction(async (tx) => {
      await tx.matchOfficial.updateMany({ where: { id: { in: data.ids } }, data: { paidAt: data.paid ? new Date() : null } });
      const names = [...new Set(rows.map((r) => r.referee.name))].join(", ");
      await audit(tx, admin, { action: data.paid ? "officials.paid" : "officials.unpaid", entityType: "referee", entityId: rows[0].refereeId, summary: `Marked ${rows.length} assignment${rows.length === 1 ? "" : "s"} ${data.paid ? "paid" : "unpaid"} (${names})` });
    });
    refresh();
    return { ok: true, message: `${rows.length} assignment${rows.length === 1 ? "" : "s"} marked ${data.paid ? "paid" : "unpaid"}` };
  });
}

const FeesInput = z.object({
  seasonId: Id,
  divisions: z.array(z.object({ id: Id, center: Money.nullish(), assistant: Money.nullish(), fourth: Money.nullish() })).max(50),
});

/** Default referee pay per role for each division of a season (Fees & eligibility). */
export async function saveRefereeFees(input: z.input<typeof FeesInput>): Promise<ActionResult> {
  return runAction(async () => {
    const data = FeesInput.parse(input);
    const admin = await requireAdminUser();
    await assertSeasonWritable(data.seasonId);
    const divs = await prisma.division.findMany({ where: { seasonId: data.seasonId }, select: { id: true } });
    if (data.divisions.some((d) => !divs.some((x) => x.id === d.id))) throw new ActionError("Some divisions aren’t in this season.", 400);
    await prisma.$transaction(async (tx) => {
      for (const d of data.divisions) {
        await tx.division.update({ where: { id: d.id }, data: { centerRefFee: d.center ?? null, assistantRefFee: d.assistant ?? null, fourthRefFee: d.fourth ?? null } });
      }
      await audit(tx, admin, { action: "referee_fees.saved", entityType: "season", entityId: data.seasonId, summary: `Saved referee fees for ${data.divisions.length} divisions` });
    });
    refresh();
    return { ok: true, message: "Referee fees saved" };
  });
}

/**
 * Emails each referee their assignments for the week starting `weekStart` (Mon–Sun). Outside
 * production mail is only logged unless MAIL_DELIVER is set, and then only to test addresses.
 */
export async function emailWeekAssignments(input: { weekStart: string }): Promise<ActionResult<{ sent: number; skipped: string[] }>> {
  return runAction(async () => {
    const weekStart = IsoDate.parse(input.weekStart);
    const admin = await requireAdminUser();
    const from = new Date(`${weekStart}T04:00:00Z`);
    const to = new Date(from.getTime() + 7 * 864e5);
    const rows = await prisma.matchOfficial.findMany({
      where: { status: { not: "DECLINED" }, match: { scheduledAt: { gte: from, lt: to }, status: { not: "CANCELLED" } } },
      include: {
        referee: true,
        match: { select: { gameNumber: true, scheduledAt: true, field: true, venue: { select: { name: true, park: { select: { name: true, address: true, city: true } } } }, homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } } },
      },
      orderBy: { match: { scheduledAt: "asc" } },
    });
    const byRef = new Map<string, typeof rows>();
    for (const r of rows) byRef.set(r.refereeId, [...(byRef.get(r.refereeId) ?? []), r]);
    const weekLabel = `the week of ${fmtDay(from)}`;
    let sent = 0;
    const skipped: string[] = [];
    for (const list of byRef.values()) {
      const ref = list[0].referee;
      if (!ref.email) {
        skipped.push(ref.name);
        continue;
      }
      const lines = list.map((o) => {
        const m = o.match;
        const where = m.venue ? `${m.venue.park.name} ${fieldName(m.venue.name)}${m.venue.park.address ? `, ${m.venue.park.address}` : ""}` : (m.field ?? "field to be announced");
        return `${fmtDay(m.scheduledAt)} ${fmtTime(m.scheduledAt)} · Game #${m.gameNumber} ${m.homeTeam.name} vs ${m.awayTeam.name} · ${ROLE_LABEL[o.role as Role]} · ${where}`;
      });
      const res = await sendMail({ to: ref.email, replyTo: admin.email, ...refereeScheduleEmail({ name: ref.name.split(" ")[0], weekLabel, lines }) });
      if (res.sent + res.logged > 0) sent++;
    }
    await audit(prisma, admin, { action: "officials.emailed", entityType: "week", entityId: weekStart, summary: `Emailed assignments for ${weekLabel} to ${sent} referee${sent === 1 ? "" : "s"}${skipped.length ? ` (no email: ${skipped.join(", ")})` : ""}` });
    return {
      ok: true,
      message: byRef.size ? `Schedules sent to ${sent} referee${sent === 1 ? "" : "s"}${skipped.length ? ` · no email for ${skipped.join(", ")}` : ""}` : "No assignments that week.",
      data: { sent, skipped },
    };
  });
}

