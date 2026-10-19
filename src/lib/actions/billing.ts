"use server";

/**
 * Registration billing for the league office: record offline payments, send a payment link,
 * waive, refund and apply a discount code. Every action checks admin access on the server,
 * writes an audit entry, never deletes a payment and recomputes the registration's paymentStatus.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit, billingSummary, ledgerWhere, methodLabel, payLinkUrl, syncPaymentStatus } from "@/lib/billing";
import { fullName, money } from "@/lib/format";
import { sendMail } from "@/lib/mail";
import { paymentLinkEmail } from "@/lib/mail-templates";
import { countDiscountUse, priceWithCode } from "@/lib/registration";
import { requireAdminUser } from "./admin-guard";
import { ActionError, runAction, type ActionResult } from "./result";

const Id = z.string().trim().min(1).max(64);
const Money = z.number({ invalid_type_error: "Enter an amount." }).positive("Enter an amount above $0.").max(10_000);
const Reason = z.string().trim().min(3, "Give a reason.").max(300);
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date.");
/** Noon Eastern on that day, so the date reads the same in every report. */
const onDay = (iso: string) => new Date(`${iso}T16:00:00Z`);

async function loadRegistration(id: string) {
  const reg = await db.registration.findUnique({
    where: { id },
    include: { season: true, division: true, player: { include: { user: { select: { email: true } } } } },
  });
  if (!reg) throw new ActionError("Registration not found.", 404);
  return reg;
}

async function balanceOf(reg: { id: string; paymentId: string | null; totalAmount: unknown }) {
  const rows = await db.payment.findMany({ where: ledgerWhere(reg), select: { amount: true, status: true, paymentType: true } });
  return billingSummary(
    Number(reg.totalAmount),
    rows.map((r) => ({ ...r, amount: Number(r.amount) })),
  );
}

function refresh(playerId: string) {
  revalidatePath(`/admin/players/${playerId}`);
  revalidatePath("/admin/registrations");
  revalidatePath("/admin/settings/payments");
  revalidatePath("/portal", "layout");
}

const RecordInput = z.object({
  registrationId: Id,
  amount: Money,
  method: z.enum(["CASH", "CHECK", "ZELLE", "VENMO", "CARD_IN_PERSON", "STRIPE", "OTHER"], { message: "Pick how they paid." }),
  reference: z.string().trim().max(80).optional(),
  paidOn: IsoDate,
  notes: z.string().trim().max(300).optional(),
});

/** Records money received outside Stripe (cash, check, Zelle…). Partial payments are fine. */
export async function recordPayment(input: z.input<typeof RecordInput>): Promise<ActionResult<{ status: string; balance: number }>> {
  return runAction(async () => {
    const data = RecordInput.parse(input);
    const admin = await requireAdminUser();
    const reg = await loadRegistration(data.registrationId);
    const before = await balanceOf(reg);
    if (data.amount > before.balance + 0.001) {
      throw new ActionError(before.balance > 0 ? `That’s more than the ${money(before.balance)} balance.` : "Nothing is owed on this registration.", 409);
    }
    const summary = await db.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: {
          userId: reg.playerId,
          amount: data.amount,
          status: "PAID",
          paymentType: "REGISTRATION_FEE",
          relatedEntityType: "registration",
          relatedEntityId: reg.id,
          method: data.method,
          reference: data.reference || null,
          notes: data.notes || null,
          recordedByUserId: admin.id,
          paidAt: onDay(data.paidOn),
        },
      });
      const s = await syncPaymentStatus(tx, reg.id);
      await audit(tx, admin, {
        action: "payment.recorded",
        entityType: "registration",
        entityId: reg.id,
        summary: `Recorded ${money(data.amount)} ${methodLabel(data.method).toLowerCase()}${data.reference ? ` (${data.reference})` : ""}`,
        data: { paymentId: p.id, amount: data.amount, method: data.method, balance: s.balance, status: s.status },
      });
      return s;
    });
    refresh(reg.playerId);
    return { ok: true, message: `${money(data.amount)} recorded · ${summary.balance > 0 ? `${money(summary.balance)} left` : "paid in full"}`, data: { status: summary.status, balance: summary.balance } };
  });
}

/** Emails a link to pay the balance online (Stripe Checkout is created when they open it). */
export async function sendPaymentLink(input: { registrationId: string }): Promise<ActionResult<{ url: string }>> {
  return runAction(async () => {
    const registrationId = Id.parse(input.registrationId);
    const admin = await requireAdminUser();
    const reg = await loadRegistration(registrationId);
    const { balance } = await balanceOf(reg);
    if (balance <= 0) throw new ActionError("Nothing is owed on this registration.", 409);
    const url = await payLinkUrl(reg.id);
    const res = await sendMail({
      to: reg.player.user.email,
      replyTo: admin.email,
      ...(await paymentLinkEmail({ firstName: reg.player.firstName, seasonName: reg.season.name, divisionName: reg.division?.name ?? "", amount: money(balance), url })),
    });
    if (res.failed) throw new ActionError("The email didn’t send. Try again in a minute.", 409);
    await audit(db, admin, {
      action: "payment.link_sent",
      entityType: "registration",
      entityId: reg.id,
      summary: `Sent a payment link for ${money(balance)} to ${reg.player.user.email}${res.sent ? "" : " (logged, not delivered)"}`,
      data: { balance, delivered: res.sent > 0 },
    });
    refresh(reg.playerId);
    return { ok: true, message: `Payment link for ${money(balance)} ${res.sent ? "sent to" : "logged for"} ${reg.player.user.email}`, data: { url } };
  });
}

const WaiveInput = z.object({ registrationId: Id, reason: Reason });

/** Waives (comps) whatever is still owed. */
export async function waiveBalance(input: z.input<typeof WaiveInput>): Promise<ActionResult> {
  return runAction(async () => {
    const data = WaiveInput.parse(input);
    const admin = await requireAdminUser();
    const reg = await loadRegistration(data.registrationId);
    const { balance } = await balanceOf(reg);
    if (balance <= 0) throw new ActionError("Nothing is owed on this registration.", 409);
    await db.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: {
          userId: reg.playerId,
          amount: balance,
          status: "WAIVED",
          paymentType: "WAIVER",
          relatedEntityType: "registration",
          relatedEntityId: reg.id,
          notes: data.reason,
          recordedByUserId: admin.id,
          paidAt: new Date(),
        },
      });
      await syncPaymentStatus(tx, reg.id);
      await audit(tx, admin, { action: "payment.waived", entityType: "registration", entityId: reg.id, summary: `Waived ${money(balance)}: ${data.reason}`, data: { paymentId: p.id, amount: balance } });
    });
    refresh(reg.playerId);
    return { ok: true, message: `${money(balance)} waived for ${fullName(reg.player)}` };
  });
}

const RefundInput = z.object({
  registrationId: Id,
  amount: Money,
  reason: Reason,
  method: z.enum(["CASH", "CHECK", "ZELLE", "VENMO", "CARD_IN_PERSON", "STRIPE", "OTHER"]).default("OTHER"),
  reference: z.string().trim().max(80).optional(),
});

/** Records money given back. The refund itself happens outside the app (Stripe dashboard, check…). */
export async function refundPayment(input: z.input<typeof RefundInput>): Promise<ActionResult> {
  return runAction(async () => {
    const data = RefundInput.parse(input);
    const admin = await requireAdminUser();
    const reg = await loadRegistration(data.registrationId);
    const { paid } = await balanceOf(reg);
    if (data.amount > paid + 0.001) throw new ActionError(paid > 0 ? `Only ${money(paid)} has been paid, so that’s the most you can refund.` : "Nothing has been paid yet.", 409);
    await db.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: {
          userId: reg.playerId,
          amount: data.amount,
          status: "REFUNDED",
          paymentType: "REFUND",
          relatedEntityType: "registration",
          relatedEntityId: reg.id,
          method: data.method,
          reference: data.reference || null,
          notes: data.reason,
          recordedByUserId: admin.id,
          paidAt: new Date(),
        },
      });
      const s = await syncPaymentStatus(tx, reg.id);
      await audit(tx, admin, {
        action: "payment.refunded",
        entityType: "registration",
        entityId: reg.id,
        summary: `Refunded ${money(data.amount)} (${methodLabel(data.method).toLowerCase()}): ${data.reason}`,
        data: { paymentId: p.id, amount: data.amount, status: s.status },
      });
    });
    refresh(reg.playerId);
    return { ok: true, message: `${money(data.amount)} refund recorded` };
  });
}

const DiscountInput = z.object({ registrationId: Id, code: z.string().trim().min(1, "Enter a code.").max(40) });

/** Applies a discount code to the registration's fee (replacing any earlier code). */
export async function applyDiscountCode(input: z.input<typeof DiscountInput>): Promise<ActionResult> {
  return runAction(async () => {
    const data = DiscountInput.parse(input);
    const admin = await requireAdminUser();
    const reg = await loadRegistration(data.registrationId);
    const fee = reg.amountBeforeDiscount != null ? Number(reg.amountBeforeDiscount) : reg.division ? Number(reg.division.registrationFee) : Number(reg.totalAmount);
    const priced = await priceWithCode({ fee, code: data.code, season: reg.season, teamId: reg.preferredTeamId });
    if (!priced.ok) throw new ActionError(priced.message, 400);
    if (!priced.discountId) throw new ActionError("Enter a code.", 400);
    if (priced.discountId === reg.discountCodeId) throw new ActionError("That code is already applied.", 409);
    await db.$transaction(async (tx) => {
      await tx.registration.update({ where: { id: reg.id }, data: { amountBeforeDiscount: fee, totalAmount: priced.total, discountCodeId: priced.discountId } });
      await countDiscountUse(tx, priced.discountId!);
      const s = await syncPaymentStatus(tx, reg.id);
      await audit(tx, admin, {
        action: "discount.applied",
        entityType: "registration",
        entityId: reg.id,
        summary: `Applied ${data.code.toUpperCase()}: ${money(fee)} → ${money(priced.total)}`,
        data: { code: data.code.toUpperCase(), before: fee, after: priced.total, status: s.status },
      });
    });
    refresh(reg.playerId);
    return { ok: true, message: `${data.code.toUpperCase()} applied · now ${money(priced.total)}` };
  });
}
