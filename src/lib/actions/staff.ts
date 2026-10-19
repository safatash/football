"use server";

/**
 * Admin › Settings › Staff: who runs the league. ADMIN can change everything; STAFF can look but not
 * change. The OWNER can't be changed here, and nobody can change their own role.
 */
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, getOrgId } from "@/lib/db";
import { requireOrgRole } from "@/lib/access";
import { audit } from "@/lib/billing";
import { appUrl } from "@/lib/branding";
import { sendMail } from "@/lib/mail";
import { staffInviteEmail } from "@/lib/mail-templates";
import { hashPassword } from "@/lib/password";
import { createToken } from "@/lib/tokens";
import { ActionError, runAction, type ActionResult } from "./result";

const INVITE_TTL_MS = 7 * 24 * 3600_000;
const ROLE_LABEL = { ADMIN: "admin", STAFF: "staff", PLAYER: "player" } as const;

const InviteInput = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254), role: z.enum(["ADMIN", "STAFF"]) });

export async function inviteStaff(input: z.input<typeof InviteInput>): Promise<ActionResult> {
  return runAction(async () => {
    const data = InviteInput.parse(input);
    const me = await requireOrgRole(["OWNER", "ADMIN"]);
    const orgId = await getOrgId();
    const existing = await db.user.findFirst({ where: { email: { equals: data.email, mode: "insensitive" } } });
    const member = existing ? await db.organizationMember.findFirst({ where: { userId: existing.id } }) : null;
    if (member?.role === "OWNER") throw new ActionError(`${data.email} owns this league.`, 409);
    if (member && member.status === "ACTIVE" && member.role === data.role) throw new ActionError(`${data.email} is already ${ROLE_LABEL[data.role]}.`, 409);

    const user = await db.$transaction(async (tx) => {
      const u =
        existing ??
        // A new login: no usable password until they follow the invitation link
        (await tx.user.create({ data: { email: data.email, password: await hashPassword(randomBytes(24).toString("base64url")) } }));
      if (member) await tx.organizationMember.update({ where: { id: member.id }, data: { role: data.role, status: "ACTIVE" } });
      else await tx.organizationMember.create({ data: { userId: u.id, organizationId: orgId, role: data.role, status: "ACTIVE", invitedAt: new Date() } });
      await audit(tx, me, { action: "staff.invited", entityType: "user", entityId: u.id, summary: `Invited ${data.email} as ${ROLE_LABEL[data.role]}` });
      return u;
    });

    const url = existing ? null : `${await appUrl()}/login/reset?token=${await createToken("reset", user.id, INVITE_TTL_MS)}`;
    await sendMail({ to: user.email, replyTo: me.email, ...(await staffInviteEmail({ role: data.role, invitedBy: me.email, url })) });
    revalidatePath("/admin/settings/staff");
    return { ok: true, message: `${data.email} is now ${ROLE_LABEL[data.role]}. We emailed them${url ? " a link to set a password" : ""}.` };
  });
}

/** The member to change: in this league, not the owner, not yourself. */
async function changeable(memberId: string, meId: string) {
  const m = await db.organizationMember.findUnique({ where: { id: memberId }, include: { user: { select: { email: true } } } });
  if (!m) throw new ActionError("That person isn’t in this league.", 404);
  if (m.role === "OWNER") throw new ActionError(`${m.user.email} owns this league, so their role can’t change here.`, 409);
  if (m.userId === meId) throw new ActionError("You can’t change your own role.", 409);
  return m;
}

const RoleInput = z.object({ memberId: z.string().trim().min(1).max(64), role: z.enum(["ADMIN", "STAFF"]) });

export async function setStaffRole(input: z.input<typeof RoleInput>): Promise<ActionResult> {
  return runAction(async () => {
    const data = RoleInput.parse(input);
    const me = await requireOrgRole(["OWNER", "ADMIN"]);
    const m = await changeable(data.memberId, me.id);
    await db.$transaction(async (tx) => {
      await tx.organizationMember.update({ where: { id: m.id }, data: { role: data.role, status: "ACTIVE" } });
      await audit(tx, me, { action: "staff.role", entityType: "user", entityId: m.userId, summary: `Changed ${m.user.email} from ${m.role.toLowerCase()} to ${ROLE_LABEL[data.role]}` });
    });
    revalidatePath("/admin/settings/staff");
    return { ok: true, message: `${m.user.email} is now ${ROLE_LABEL[data.role]}` };
  });
}

/** Takes away league-office access. Players keep their player membership; others are removed. */
export async function removeStaff(input: { memberId: string }): Promise<ActionResult> {
  return runAction(async () => {
    const { memberId } = z.object({ memberId: z.string().trim().min(1).max(64) }).parse(input);
    const me = await requireOrgRole(["OWNER", "ADMIN"]);
    const m = await changeable(memberId, me.id);
    const isPlayer = (await db.player.count({ where: { userId: m.userId } })) > 0;
    await db.$transaction(async (tx) => {
      await tx.organizationMember.update({ where: { id: m.id }, data: isPlayer ? { role: "PLAYER" } : { role: "PLAYER", status: "REMOVED" } });
      await audit(tx, me, { action: "staff.removed", entityType: "user", entityId: m.userId, summary: `Removed league-office access for ${m.user.email}` });
    });
    revalidatePath("/admin/settings/staff");
    return { ok: true, message: `${m.user.email} no longer has league-office access` };
  });
}
