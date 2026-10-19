"use server";

import { db } from "@/lib/db";
import { accountPasswordErrors, hashPassword, verifyPassword } from "@/lib/password";
import { getSession } from "@/lib/session";

export type PasswordState = { ok: true; message: string } | { ok: false; error: string; fieldErrors?: Record<string, string> } | null;

/** Changes the signed-in user's password. Works for admins without a player profile too. */
export async function changePassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Your session has expired. Log in again to change your password." };

  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  const fieldErrors: Record<string, string> = {};
  if (!current) fieldErrors.currentPassword = "Enter your current password";
  const rules = accountPasswordErrors(next);
  if (rules.length) fieldErrors.newPassword = rules.join(", ");
  else if (next === current) fieldErrors.newPassword = "Choose a password you haven’t used here";
  if (next !== confirm) fieldErrors.confirmPassword = "Passwords don’t match";
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Check the highlighted fields.", fieldErrors };

  const user = await db.user.findUnique({ where: { id: userId }, select: { password: true } });
  if (!user) return { ok: false, error: "We couldn’t find your account. Log in again." };
  if (!(await verifyPassword(current, user.password))) {
    return { ok: false, error: "Check the highlighted fields.", fieldErrors: { currentPassword: "That isn’t your current password" } };
  }

  try {
    await db.user.update({ where: { id: userId }, data: { password: await hashPassword(next) } });
  } catch {
    return { ok: false, error: "We couldn’t change your password. Try again in a moment." };
  }
  return { ok: true, message: "Password changed" };
}
