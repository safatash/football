"use server";

/**
 * A player deletes their own account (profile › Delete account). Personal details on this
 * league's profile are replaced; the league keeps the registrations, payments and ledger it
 * needs, now pointing at an anonymous "Deleted player". The membership ends, so they can't sign
 * in here again. The login itself is erased too unless another league still uses it
 * (src/platform/accounts.ts).
 */
import { z } from "zod";
import { db, getOrgId, leagueTransaction } from "@/lib/db";
import { canViewOffice } from "@/lib/access";
import { now } from "@/lib/clock";
import { getSession } from "@/lib/session";
import { UnauthorizedError } from "@/lib/team-access";
import { effectiveRole } from "@/platform/identity";
import { forgetLoginIfUnused } from "@/platform/accounts";
import { ActionError, runAction, type ActionResult } from "./result";

const Input = z.object({ confirmEmail: z.string().trim().max(254) });

export async function deleteMyAccount(input: z.input<typeof Input>): Promise<ActionResult<{ loginErased: boolean }>> {
  return runAction(
    async () => {
      const { confirmEmail } = Input.parse(input);
      const session = await getSession();
      const userId = session?.user?.id;
      const playerId = session?.user?.playerId;
      if (!userId || !playerId) throw new UnauthorizedError("Sign in to continue.");

      await leagueTransaction(async () => {
        const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
        if (!user) throw new UnauthorizedError("Sign in to continue.");
        if (confirmEmail.toLowerCase() !== user.email.toLowerCase()) throw new ActionError("Type the email on your account to confirm.", 400);
        // The league office's own accounts aren't removed this way: someone has to hand over first
        const role = await effectiveRole(userId, await getOrgId());
        if (role && canViewOffice(role.role)) throw new ActionError("You’re part of the league office. Ask another admin to remove your office access first.", 409);

        const player = await db.player.findUnique({ where: { id: playerId }, select: { id: true, userId: true, anonymizedAt: true } });
        if (!player || player.userId !== userId) throw new UnauthorizedError("Sign in to continue.");
        if (player.anonymizedAt) throw new ActionError("This account was already deleted.", 409);

        const at = now();
        await db.player.update({
          where: { id: player.id },
          data: {
            firstName: "Deleted",
            lastName: "player",
            dob: new Date("1900-01-01T00:00:00Z"),
            phone: "",
            address: "",
            city: "",
            state: "",
            zip: "",
            county: null,
            emergencyContactName: null,
            emergencyContactPhone: null,
            photo: null,
            photoId: null,
            photoUrl: null,
            legacyKey: null,
            contactMe: false,
            social: false,
            tournaments: false,
            status: "INACTIVE",
            anonymizedAt: at,
          },
        });
        // Free text the player wrote; the league's own notes and the ledger stay
        await db.registration.updateMany({ where: { playerId: player.id }, data: { playerNote: null, captainNote: null } });
        await db.captainRequest.deleteMany({ where: { playerId: player.id, status: "PENDING" } });
        await db.teamRoster.updateMany({ where: { playerId: player.id, leftAt: null }, data: { leftAt: at } });
        await db.organizationMember.updateMany({ where: { userId }, data: { status: "REMOVED" } });
        await db.auditLog.create({
          data: { actorUserId: null, actorEmail: "player (deleted)", action: "account.deleted", entityType: "player", entityId: player.id, summary: "Player deleted their account; personal details removed" },
        });
      });

      // After the league's part is committed: the shared login, if nothing else uses it
      const loginErased = await forgetLoginIfUnused(userId);
      return { ok: true, message: "Your account is deleted", data: { loginErased } };
    },
    { transaction: false },
  );
}
