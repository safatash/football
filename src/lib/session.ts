import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export { isAdminEmail } from "@/lib/admin";

export async function getSession() {
  return getServerSession(authOptions);
}

/** For pages: signed-in user or redirect to /login. */
export async function requireUser(next?: string) {
  const session = await getSession();
  if (!session?.user) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  return session;
}

/** For pages: league-office user, otherwise redirect. */
export async function requireAdmin() {
  const session = await requireUser("/admin");
  if (!session.user.isAdmin) redirect("/portal?denied=admin");
  return session;
}
