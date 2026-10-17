/**
 * League-office access. A user is an admin when their `role` is ADMIN or their email is listed
 * in ADMIN_EMAILS (comma-separated). ADMIN_EMAILS defaults to the seeded safatash@gmail.com account.
 */
export function isAdminEmail(email?: string | null) {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS ?? "safatash@gmail.com")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

export function isAdminUser(user?: { email?: string | null; role?: string | null } | null) {
  if (!user) return false;
  return user.role === "ADMIN" || isAdminEmail(user.email);
}
