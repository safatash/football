/**
 * Account deletion, the cross-league part. A login (User) is shared by every league the person
 * plays in, so a player deleting their account in one league only erases the login when nothing
 * else uses it: no other league profile still in use, no membership anywhere, not the operator.
 */
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import prisma from "./prisma";

/** The address a forgotten login gets (unique, never deliverable). */
export const deletedEmail = (userId: string) => `deleted-${userId}@deleted.invalid`;

/** Erases the login (email, password, sessions, tokens) if no league still uses it. Returns whether it did. */
export async function forgetLoginIfUnused(userId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { isPlatformAdmin: true } });
    if (!user || user.isPlatformAdmin) return false;
    const [profiles, memberships] = await Promise.all([
      tx.player.count({ where: { userId, anonymizedAt: null } }),
      tx.organizationMember.count({ where: { userId, status: { not: "REMOVED" } } }),
    ]);
    if (profiles > 0 || memberships > 0) return false;
    await tx.user.update({ where: { id: userId }, data: { email: deletedEmail(userId), password: await bcrypt.hash(randomBytes(24).toString("base64url"), 10) } });
    await tx.session.deleteMany({ where: { userId } });
    await tx.account.deleteMany({ where: { userId } });
    await tx.verificationToken.deleteMany({ where: { identifier: { endsWith: `:${userId}` } } });
    return true;
  });
}
