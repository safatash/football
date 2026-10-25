import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { playerInOrg, getOrgId } from "@/lib/org";
import { sendMail } from "@/lib/mail";
import { passwordResetEmail } from "@/lib/mail-templates";
import { appUrl } from "@/lib/branding";
import { createToken } from "@/lib/tokens";
import { LIMITS, clientIp, hitAll, honeypotFilled, rateKey, tooMany } from "@/platform/rate-limit";

const Body = z.object({ email: z.string().trim().email().max(254) });

/** Sends a password reset link. Answers the same way whether or not the email has an account. */
export async function POST(req: NextRequest) {
  const raw = await req.json().catch(() => null);
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  const limited = await hitAll([
    [rateKey("recovery-ip", await clientIp(req)), LIMITS.recoveryIp],
    [rateKey("recovery-email", parsed.data.email), LIMITS.recoveryEmail],
  ]);
  if (!limited.ok) return tooMany(limited);
  // Bots fill the hidden field: answer as usual, send nothing
  if (honeypotFilled(raw)) return NextResponse.json({ ok: true });
  const user = await db.user.findFirst({ where: { email: { equals: parsed.data.email, mode: "insensitive" } }, include: { players: playerInOrg(await getOrgId()) } });
  if (user && user.players[0]?.status !== "INACTIVE") {
    const token = await createToken("reset", user.id);
    await sendMail({ to: user.email, ...(await passwordResetEmail({ firstName: user.players[0]?.firstName ?? "there", url: `${(await appUrl())}/login/reset?token=${token}` })) });
  }
  return NextResponse.json({ ok: true });
}
