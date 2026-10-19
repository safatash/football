import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export async function getSession() {
  return getServerSession(authOptions);
}

/** For pages: signed-in user or redirect to /login. */
export async function requireUser(next?: string) {
  const session = await getSession();
  if (!session?.user) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  return session;
}

/** For pages: league-office user (OWNER, ADMIN, or STAFF read-only), otherwise redirect. */
export async function requireAdmin() {
  const session = await requireUser("/admin");
  if (!session.user.canViewOffice) redirect("/portal?denied=admin");
  return session;
}
