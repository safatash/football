/**
 * Registration billing. A registration owes its `totalAmount` (division fee minus any discount).
 * Payments are a ledger linked by relatedEntityType "registration": money in (PAID), refunds
 * (REFUND / REFUNDED) and waivers (WAIVER / WAIVED). Rows are never deleted; the registration's
 * paymentStatus is recomputed from the ledger after every change.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentMethod, PaymentStatus, Prisma } from "@prisma/client";
import type { DbTx } from "@/lib/db";
import { appUrl } from "@/lib/stripe";

type Db = DbTx;

export const METHODS: [PaymentMethod, string][] = [
  ["CASH", "Cash"],
  ["CHECK", "Check"],
  ["ZELLE", "Zelle"],
  ["VENMO", "Venmo"],
  ["CARD_IN_PERSON", "Card in person"],
  ["STRIPE", "Stripe"],
  ["OTHER", "Other"],
];
export const methodLabel = (m: PaymentMethod | null | undefined) => (m ? (METHODS.find(([k]) => k === m)?.[1] ?? m) : "—");

export const BILLING_STATUSES: [PaymentStatus, string][] = [
  ["UNPAID", "Unpaid"],
  ["PARTIAL", "Partly paid"],
  ["PAID", "Paid"],
  ["WAIVED", "Waived"],
  ["REFUNDED", "Refunded"],
];

export type LedgerEntry = { amount: number; status: PaymentStatus; paymentType: string };

const cents = (n: number) => Math.round(n * 100) / 100;

/** Amount due, paid (net of refunds), waived, balance and the registration's payment status. */
export function billingSummary(due: number, entries: LedgerEntry[]) {
  let paid = 0;
  let refunded = 0;
  let waived = 0;
  for (const e of entries) {
    if (e.status === "PAID") paid += e.amount;
    else if (e.status === "REFUNDED") refunded += e.amount;
    else if (e.status === "WAIVED") waived += e.amount;
  }
  const net = cents(paid - refunded);
  const balance = cents(Math.max(0, due - net - waived));
  let status: PaymentStatus;
  if (refunded > 0 && net <= 0) status = "REFUNDED";
  else if (balance <= 0) status = waived > 0 && net < due ? "WAIVED" : "PAID";
  else if (net > 0) status = "PARTIAL";
  else status = "UNPAID";
  return { due: cents(due), paid: net, refunded: cents(refunded), waived: cents(waived), balance, status };
}

/** Ledger rows for a registration (including the payment linked by the original checkout). */
export const ledgerWhere = (reg: { id: string; paymentId: string | null }) =>
  ({ OR: [{ relatedEntityType: "registration", relatedEntityId: reg.id }, ...(reg.paymentId ? [{ id: reg.paymentId }] : [])] }) satisfies Prisma.PaymentWhereInput;

/** Recomputes and stores a registration's paymentStatus; returns the summary. */
export async function syncPaymentStatus(db: Db, registrationId: string) {
  const reg = await db.registration.findUniqueOrThrow({ where: { id: registrationId }, select: { id: true, paymentId: true, totalAmount: true, paymentStatus: true } });
  const rows = await db.payment.findMany({ where: ledgerWhere(reg), select: { amount: true, status: true, paymentType: true } });
  const summary = billingSummary(
    Number(reg.totalAmount),
    rows.map((r) => ({ ...r, amount: Number(r.amount) })),
  );
  if (summary.status !== reg.paymentStatus) await db.registration.update({ where: { id: reg.id }, data: { paymentStatus: summary.status } });
  return summary;
}

/** Writes an audit entry (inside the caller's transaction when given one). */
export async function audit(
  db: Db,
  actor: { id: string; email: string },
  entry: { action: string; entityType: string; entityId: string; summary: string; data?: Prisma.InputJsonValue },
) {
  await db.auditLog.create({ data: { actorUserId: actor.id, actorEmail: actor.email, ...entry } });
}

/* ---------- Payment links ---------- */

function secret() {
  const s = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET is not set");
  return s;
}
const sign = (registrationId: string) => createHmac("sha256", secret()).update(`pay:${registrationId}`).digest("base64url").slice(0, 32);

/** A link to pay a registration's balance online. It never expires; it always charges the current balance. */
export const payLinkUrl = (registrationId: string) => `${appUrl()}/pay/${registrationId}?sig=${sign(registrationId)}`;

export function payLinkValid(registrationId: string, sig: string | null | undefined) {
  if (!sig) return false;
  const want = Buffer.from(sign(registrationId));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}
