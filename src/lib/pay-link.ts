import prisma from "@/lib/prisma";
import { billingSummary, ledgerWhere, payLinkValid } from "@/lib/billing";

/** The registration behind a payment link, or null when the link is wrong. */
export async function loadPayLink(registrationId: string, sig: string | null | undefined) {
  if (!payLinkValid(registrationId, sig)) return null;
  const reg = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: { season: { select: { name: true } }, division: { select: { name: true } }, player: { select: { firstName: true, lastName: true, user: { select: { email: true } } } } },
  });
  if (!reg) return null;
  const rows = await prisma.payment.findMany({ where: ledgerWhere(reg), select: { amount: true, status: true, paymentType: true } });
  const summary = billingSummary(
    Number(reg.totalAmount),
    rows.map((r) => ({ ...r, amount: Number(r.amount) })),
  );
  return { reg, summary };
}
