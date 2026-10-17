/** Registration fees and discount codes. Amounts are dollars; results are rounded to cents. */
export type DiscountRule = {
  code: string;
  kind: "BOARD" | "PROMO" | "TEAM_PAID";
  type: "PERCENT" | "AMOUNT";
  value: number;
  maxUses: number | null;
  uses: number;
  active: boolean;
  seasonId: string;
  teamId: string | null;
};

export const normalizeCode = (code: string) => code.trim().toUpperCase();

const cents = (n: number) => Math.round(n * 100) / 100;

/** Checks a code for this season and (for TEAM_PAID codes) this preferred team. */
export function validateDiscount(
  rule: DiscountRule | null,
  ctx: { code: string; seasonId: string; seasonName: string; teamId: string | null },
): { ok: true } | { ok: false; message: string } {
  const code = normalizeCode(ctx.code);
  if (!code) return { ok: false, message: "Enter a code first." };
  const invalid = { ok: false as const, message: `“${code}” isn’t a valid code for ${ctx.seasonName}.` };
  if (!rule || rule.seasonId !== ctx.seasonId || !rule.active) return invalid;
  if (rule.maxUses != null && rule.uses >= rule.maxUses) return { ok: false, message: `“${code}” has been used up.` };
  if (rule.kind === "TEAM_PAID" && rule.teamId && rule.teamId !== ctx.teamId) {
    return { ok: false, message: `“${code}” only works when your preferred team is the team that paid.` };
  }
  return { ok: true };
}

/** Discount for a fee; never more than the fee. */
export function discountAmount(fee: number, rule: Pick<DiscountRule, "type" | "value"> | null) {
  if (!rule) return 0;
  const raw = rule.type === "PERCENT" ? (fee * Math.min(Math.max(rule.value, 0), 100)) / 100 : Math.max(rule.value, 0);
  return cents(Math.min(fee, raw));
}

export function priceRegistration(fee: number, rule: Pick<DiscountRule, "type" | "value"> | null) {
  const discount = discountAmount(fee, rule);
  return { fee: cents(fee), discount, total: cents(Math.max(0, fee - discount)) };
}

/** "100% off", "$10 off" */
export const discountLabel = (rule: Pick<DiscountRule, "type" | "value">) =>
  rule.type === "PERCENT" ? `${rule.value}% off` : `$${Number.isInteger(rule.value) ? rule.value : rule.value.toFixed(2)} off`;
