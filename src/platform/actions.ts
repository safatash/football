"use server";

/** Operator actions (the /platform area). Each checks `platformUser()` first. */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runWithOrg } from "./db";
import { platformUser } from "./guard";
import { createOrganization, slugAvailability, startImpersonation, STATUSES, updateOrganization } from "./organizations";
import { orgById } from "./orgs";
import { sendMail } from "@/lib/mail";
import { staffInviteEmail } from "@/lib/mail-templates";
import { leagueOrigin } from "@/lib/tenant";
import { createToken } from "@/lib/tokens";
import { ActionError, runAction, type ActionResult } from "@/lib/actions/result";

const Id = z.string().trim().min(1).max(64);

export async function checkSlug(slug: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  await platformUser();
  return slugAvailability(slug.trim().toLowerCase());
}

const CreateInput = z.object({
  name: z.string().trim().min(2, "Name the league.").max(60),
  slug: z.string().trim().toLowerCase(),
  ownerEmail: z.string().trim().toLowerCase().email("Enter the owner’s email."),
  plan: z.string().trim().min(1).max(40).default("pilot"),
  status: z.enum(["TRIAL", "ACTIVE"]).default("TRIAL"),
});

/** Manual onboarding: a league, its settings and an OWNER (invited by email if they're new). */
export async function createOrganizationAction(input: z.input<typeof CreateInput>): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const data = CreateInput.parse(input);
    const me = await platformUser();
    const avail = await slugAvailability(data.slug);
    if (!avail.ok) throw new ActionError(avail.reason, 409);
    const { org, owner, newOwner } = await createOrganization({ name: data.name, slug: data.slug, ownerEmail: data.ownerEmail, plan: data.plan, status: data.status }, me);
    await runWithOrg(org.id, async () => {
      const url = newOwner ? `${leagueOrigin(org)}/login/reset?token=${await createToken("reset", owner.id, 7 * 24 * 3600_000)}` : null;
      await sendMail({ to: owner.email, ...(await staffInviteEmail({ role: "OWNER", invitedBy: me.email, url })) });
    });
    revalidatePath("/platform");
    return { ok: true, message: `${org.name} created. We emailed ${owner.email}.`, data: { id: org.id } };
  });
}

const StatusInput = z.object({ id: Id, status: z.enum(STATUSES as [string, ...string[]]) });
export async function setOrganizationStatus(input: z.input<typeof StatusInput>): Promise<ActionResult> {
  return runAction(async () => {
    const data = StatusInput.parse(input);
    const me = await platformUser();
    const org = await orgById(data.id);
    if (!org) throw new ActionError("No such league.", 404);
    await updateOrganization(data.id, { status: data.status as (typeof STATUSES)[number] }, me, `Status changed from ${org.status} to ${data.status} by platform`);
    revalidatePath(`/platform/orgs/${data.id}`);
    return { ok: true, message: `${org.name} is now ${data.status.toLowerCase().replace("_", " ")}` };
  });
}

const PlanInput = z.object({ id: Id, plan: z.string().trim().min(1, "Name the plan.").max(40) });
export async function setOrganizationPlan(input: z.input<typeof PlanInput>): Promise<ActionResult> {
  return runAction(async () => {
    const data = PlanInput.parse(input);
    const me = await platformUser();
    const org = await orgById(data.id);
    if (!org) throw new ActionError("No such league.", 404);
    await updateOrganization(data.id, { plan: data.plan }, me, `Plan set to ${data.plan} by platform`);
    revalidatePath(`/platform/orgs/${data.id}`);
    return { ok: true, message: `Plan set to ${data.plan}` };
  });
}

const TrialInput = z.object({ id: Id, days: z.number().int().min(1).max(365) });
/** Extends the trial from its end date (or from today if it already ended). */
export async function extendTrial(input: z.input<typeof TrialInput>): Promise<ActionResult> {
  return runAction(async () => {
    const data = TrialInput.parse(input);
    const me = await platformUser();
    const { default: prisma } = await import("./prisma");
    const org = await prisma.organization.findUnique({ where: { id: data.id }, select: { name: true, trialEndsAt: true } });
    if (!org) throw new ActionError("No such league.", 404);
    const from = org.trialEndsAt && org.trialEndsAt > new Date() ? org.trialEndsAt : new Date();
    const until = new Date(from.getTime() + data.days * 24 * 3600_000);
    await updateOrganization(data.id, { trialEndsAt: until, status: "TRIAL" }, me, `Trial extended ${data.days} days to ${until.toISOString().slice(0, 10)} by platform`);
    revalidatePath(`/platform/orgs/${data.id}`);
    return { ok: true, message: `Trial runs until ${until.toISOString().slice(0, 10)}` };
  });
}

const ImpersonateInput = z.object({ id: Id, reason: z.string().trim().max(200).optional() });
/** Starts acting as the league's admin and returns a one-time sign-in link on the league's host. */
export async function impersonateAdmin(input: z.input<typeof ImpersonateInput>): Promise<ActionResult<{ url: string }>> {
  return runAction(async () => {
    const data = ImpersonateInput.parse(input);
    const me = await platformUser();
    const org = await orgById(data.id);
    if (!org) throw new ActionError("No such league.", 404);
    await startImpersonation(org.id, me, data.reason || null);
    // Sessions are per host: sign in on the league's address with a short-lived link
    const token = await runWithOrg(org.id, () => createToken("login", me.id, 2 * 60_000));
    return { ok: true, message: "Opening the league office…", data: { url: `${leagueOrigin(org)}/login/link?token=${token}&next=/admin` } };
  });
}
