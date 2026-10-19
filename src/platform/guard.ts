/** The operator area: only `isPlatformAdmin` users, only on the platform host (root or admin.<root>). */
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { ForbiddenError } from "@/lib/team-access";
import { currentOrgIdOrNull, platformFlags } from "./identity";

export class PlatformForbiddenError extends ForbiddenError {}

/** For server actions: the operator, or throw. */
export async function platformUser() {
  const session = await getSession();
  const flags = session?.user?.id ? await platformFlags(session.user.id) : null;
  if (!flags?.isPlatformAdmin || (await currentOrgIdOrNull())) throw new PlatformForbiddenError("Only the platform operator can do that.");
  return { id: flags.id, email: flags.email };
}

/** For pages: the operator; anyone else gets a 404 (the area isn't advertised). */
export async function requirePlatformAdmin() {
  if (await currentOrgIdOrNull()) notFound();
  const session = await getSession();
  if (!session?.user) redirect("/login?next=/platform");
  const flags = await platformFlags(session.user.id);
  if (!flags?.isPlatformAdmin) notFound();
  return { id: flags.id, email: flags.email };
}
