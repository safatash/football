/**
 * League-office access. Until the schema has a role column, admins are the emails listed in
 * ADMIN_EMAILS (comma-separated). Defaults to the seeded safatash@gmail.com account.
 */
export function isAdminEmail(email?: string | null) {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS ?? "safatash@gmail.com")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}
