"use server";

/**
 * Settings › Online payments: connect the league's Stripe Express account (and the setup
 * checklist step). OWNER or ADMIN only; both actions call Stripe, so no league transaction.
 */
import { db, getOrgId } from "@/lib/db";
import { requireOrgRole } from "@/lib/access";
import { getBrand } from "@/lib/branding";
import { dashboardLink, startOnboarding, StripeLiveModeError } from "@/platform/payments";
import { ActionError, runAction, type ActionResult } from "./result";

const PAGE = "/admin/settings/online-payments";

export async function startPaymentsOnboarding(): Promise<ActionResult<{ url: string }>> {
  return runAction(
    async () => {
      const me = await requireOrgRole(["OWNER", "ADMIN"]);
      if (!process.env.STRIPE_SECRET_KEY) throw new ActionError("Stripe isn’t set up on this server yet (STRIPE_SECRET_KEY).", 409);
      const orgId = await getOrgId();
      const { url: leagueUrl } = await getBrand();
      let url: string;
      try {
        url = await startOnboarding(orgId, { leagueUrl, returnUrl: `${leagueUrl}${PAGE}?stripe=return`, refreshUrl: `${leagueUrl}${PAGE}?stripe=refresh` });
      } catch (e) {
        if (e instanceof StripeLiveModeError) throw new ActionError(e.message, 409);
        throw e;
      }
      await db.auditLog.create({ data: { actorUserId: me.id, actorEmail: me.email, action: "payments.onboarding", entityType: "organization", entityId: orgId, summary: "Opened Stripe onboarding for online payments" } });
      return { ok: true, message: "Opening Stripe…", data: { url } };
    },
    { transaction: false },
  );
}

export async function openStripeDashboard(): Promise<ActionResult<{ url: string }>> {
  return runAction(
    async () => {
      await requireOrgRole(["OWNER", "ADMIN"]);
      const url = await dashboardLink(await getOrgId());
      if (!url) throw new ActionError("Connect your Stripe account first.", 409);
      return { ok: true, message: "Opening Stripe…", data: { url } };
    },
    { transaction: false },
  );
}
