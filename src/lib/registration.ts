import { db, type DbTx } from "@/lib/db";
import { getOrgId } from "@/lib/org";
import { normalizeCode, priceRegistration, validateDiscount, type DiscountRule } from "@/lib/fees";

type Db = DbTx;

export async function loadDiscount(code: string, client: Db = db): Promise<(DiscountRule & { id: string }) | null> {
  const c = normalizeCode(code);
  if (!c) return null;
  const row = await client.discountCode.findUnique({ where: { organizationId_code: { organizationId: (await getOrgId()), code: c } } });
  if (!row) return null;
  return { ...row, value: Number(row.value) };
}

/** Prices a registration for a division fee, validating the discount code against the season and team. */
export async function priceWithCode(opts: { fee: number; code: string; season: { id: string; name: string }; teamId: string | null }) {
  const code = normalizeCode(opts.code);
  if (!code) return { ok: true as const, discountId: null, ...priceRegistration(opts.fee, null) };
  const rule = await loadDiscount(code);
  const check = validateDiscount(rule, { code, seasonId: opts.season.id, seasonName: opts.season.name, teamId: opts.teamId });
  if (!check.ok) return { ok: false as const, message: check.message };
  return { ok: true as const, discountId: rule!.id, ...priceRegistration(opts.fee, rule) };
}

/**
 * Counts a discount code use. Runs inside the transaction that marks a registration paid (webhook)
 * or submits a free one, and refuses to go past maxUses.
 */
export async function countDiscountUse(tx: DbTx, discountCodeId: string) {
  const code = await tx.discountCode.findUnique({ where: { id: discountCodeId }, select: { maxUses: true } });
  if (!code) return;
  await tx.discountCode.updateMany({
    where: { id: discountCodeId, ...(code.maxUses != null ? { uses: { lt: code.maxUses } } : {}) },
    data: { uses: { increment: 1 } },
  });
}
