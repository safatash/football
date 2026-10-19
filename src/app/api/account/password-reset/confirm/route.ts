import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { accountPasswordErrors, hashPassword } from "@/lib/password";
import { consumeToken } from "@/lib/tokens";

const Body = z.object({ token: z.string().min(10).max(200), password: z.string().max(200) });

/** Sets a new password from a reset link (single use). Returns the email so the page can sign in. */
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "This reset link isn’t valid." }, { status: 400 });
  const problems = accountPasswordErrors(parsed.data.password);
  if (problems.length) return NextResponse.json({ error: problems.join(", ") }, { status: 400 });
  const userId = await consumeToken("reset", parsed.data.token);
  if (!userId) return NextResponse.json({ error: "This reset link has expired or was already used. Ask for a new one." }, { status: 410 });
  const user = await db.user.update({ where: { id: userId }, data: { password: await hashPassword(parsed.data.password) } });
  // Any other outstanding links for this account stop working
  await db.verificationToken.deleteMany({ where: { identifier: { in: [`reset:${userId}`, `login:${userId}`] } } });
  return NextResponse.json({ ok: true, email: user.email });
}
