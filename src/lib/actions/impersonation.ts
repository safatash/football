"use server";

/** The "Stop" button on the impersonation banner (runs on the league's address). */
import { getOrgId } from "@/lib/db";
import { getSession } from "@/lib/session";
import { platformOrigin } from "@/lib/tenant";
import { platformFlags } from "@/platform/identity";
import { stopImpersonation } from "@/platform/organizations";
import { runAction, type ActionResult } from "./result";
import { UnauthorizedError } from "@/lib/team-access";

export async function stopImpersonating(): Promise<ActionResult<{ url: string }>> {
  return runAction(async () => {
    const session = await getSession();
    const me = session?.user?.id ? await platformFlags(session.user.id) : null;
    if (!me?.isPlatformAdmin) throw new UnauthorizedError("Sign in to continue.");
    const orgId = await getOrgId();
    await stopImpersonation(orgId, me);
    return { ok: true, message: "Stopped acting as an admin", data: { url: `${platformOrigin()}/platform/orgs/${orgId}` } };
    // Owner connection only (src/platform): no league transaction needed
  }, { transaction: false });
}
