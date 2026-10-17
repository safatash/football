/**
 * League-office access. Until the schema has a role column, admins are the emails listed in
 * ADMIN_EMAILS (comma-separated). Defaults to the seeded admin@nvasa.org account.
 */
export function isAdminEmail(email?: string | null) {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS ?? "admin@nvasa.org")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}
