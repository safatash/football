import { createHash, randomBytes } from "node:crypto";
import prisma from "@/lib/prisma";

/** Login links and password resets: random, single-use, 30 minutes. Only a hash is stored. */
export type TokenPurpose = "login" | "reset";
export const TOKEN_TTL_MS = 30 * 60_000;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const identifier = (purpose: TokenPurpose, userId: string) => `${purpose}:${userId}`;

export async function createToken(purpose: TokenPurpose, userId: string) {
  const token = randomBytes(32).toString("base64url");
  // One live token per user and purpose
  await prisma.verificationToken.deleteMany({ where: { identifier: identifier(purpose, userId) } });
  await prisma.verificationToken.create({ data: { identifier: identifier(purpose, userId), token: hash(token), expires: new Date(Date.now() + TOKEN_TTL_MS) } });
  return token;
}

/** Returns the user id and deletes the token, or null if it's unknown, used or expired. */
export async function consumeToken(purpose: TokenPurpose, token: string): Promise<string | null> {
  if (!token || token.length > 200) return null;
  const row = await prisma.verificationToken.findUnique({ where: { token: hash(token) } });
  if (!row || !row.identifier.startsWith(`${purpose}:`)) return null;
  // Delete first: a token works once even if two requests race
  const deleted = await prisma.verificationToken.deleteMany({ where: { token: row.token } });
  if (!deleted.count || row.expires < new Date()) return null;
  return row.identifier.slice(purpose.length + 1);
}

/** Checks a token without using it (to show the reset form). */
export async function peekToken(purpose: TokenPurpose, token: string) {
  if (!token || token.length > 200) return false;
  const row = await prisma.verificationToken.findUnique({ where: { token: hash(token) } });
  return !!row && row.identifier.startsWith(`${purpose}:`) && row.expires > new Date();
}
